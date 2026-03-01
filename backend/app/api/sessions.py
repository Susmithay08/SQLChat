from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db, Session, QueryHistory
from app.services.ai import get_real_db_schema
from datetime import datetime, timezone

router = APIRouter()


class SessionCreate(BaseModel):
    name: str = "New Chat"
    mode: str = "demo"
    connection_string: Optional[str] = None


class SessionRename(BaseModel):
    name: str


def _session_dict(s: Session) -> dict:
    return {
        "id": s.id, "name": s.name, "mode": s.mode,
        "db_type": s.db_type, "has_connection": bool(s.connection_string),
        "created_at": s.created_at, "updated_at": s.updated_at,
    }


@router.get("")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).order_by(desc(Session.updated_at)))
    return [_session_dict(s) for s in result.scalars().all()]


@router.post("")
async def create_session(req: SessionCreate, db: AsyncSession = Depends(get_db)):
    session = Session(name=req.name, mode=req.mode)

    if req.mode == "real" and req.connection_string:
        schema, dialect, error = await get_real_db_schema(req.connection_string)
        if error:
            raise HTTPException(400, f"Could not connect: {error}")
        session.connection_string = req.connection_string
        session.db_type = dialect
        session.schema_snapshot = {"schema": schema, "dialect": dialect}

    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _session_dict(session)


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Session, session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return _session_dict(s)


@router.patch("/{session_id}")
async def rename_session(session_id: str, req: SessionRename, db: AsyncSession = Depends(get_db)):
    s = await db.get(Session, session_id)
    if not s:
        raise HTTPException(404)
    s.name = req.name
    s.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _session_dict(s)


@router.delete("/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    s = await db.get(Session, session_id)
    if not s:
        raise HTTPException(404)
    # delete history too
    result = await db.execute(select(QueryHistory).where(QueryHistory.session_id == session_id))
    for q in result.scalars().all():
        await db.delete(q)
    await db.delete(s)
    await db.commit()
    return {"deleted": True}


@router.get("/{session_id}/history")
async def get_history(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.session_id == session_id)
        .order_by(QueryHistory.created_at)
    )
    items = result.scalars().all()
    return [{
        "id": q.id, "session_id": q.session_id,
        "question": q.question, "sql": q.sql,
        "result_rows": q.result_rows, "result_columns": q.result_columns,
        "row_count": q.row_count, "error": q.error,
        "success": q.success, "explanation": q.explanation,
        "execution_ms": q.execution_ms, "created_at": q.created_at,
    } for q in items]
