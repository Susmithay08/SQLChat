from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db, Session, QueryHistory
from app.services.ai import generate_sql
from app.services.demo_db import run_demo_query, SCHEMA_DESCRIPTION, EXAMPLE_QUESTIONS
from app.services.executor import run_real_query
from datetime import datetime, timezone

router = APIRouter()


class AskRequest(BaseModel):
    session_id: str
    question: str
    groq_api_key: Optional[str] = None


class RunSQLRequest(BaseModel):
    session_id: str
    sql: str


@router.get("/examples")
async def get_examples():
    return {"examples": EXAMPLE_QUESTIONS}


@router.get("/schema")
async def get_demo_schema():
    return {"schema": SCHEMA_DESCRIPTION}


@router.post("/ask")
async def ask(req: AskRequest, db: AsyncSession = Depends(get_db)):
    # Load session
    session = await db.get(Session, req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Load recent history for context
    hist_result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.session_id == req.session_id)
        .order_by(QueryHistory.created_at.desc())
        .limit(6)
    )
    history_items = list(reversed(hist_result.scalars().all()))
    history = [{"question": h.question, "sql": h.sql, "explanation": h.explanation} for h in history_items]

    # Determine schema + dialect
    if session.mode == "real" and session.schema_snapshot:
        schema = session.schema_snapshot.get("schema", "")
        dialect = session.schema_snapshot.get("dialect", "SQL")
    else:
        schema = SCHEMA_DESCRIPTION
        dialect = "SQLite"

    # Generate SQL
    ai_result = await generate_sql(
        question=req.question,
        schema=schema,
        dialect=dialect,
        history=history,
        groq_api_key=req.groq_api_key,
    )

    if ai_result["error"]:
        # Save failed attempt
        q = QueryHistory(
            session_id=req.session_id, question=req.question,
            sql=None, error=ai_result["error"], success=False,
        )
        db.add(q)
        await db.commit()
        raise HTTPException(422, ai_result["error"])

    sql = ai_result["sql"]
    explanation = ai_result["explanation"]

    # Execute
    if session.mode == "real" and session.connection_string:
        exec_result = await run_real_query(session.connection_string, sql)
    else:
        exec_result = run_demo_query(sql)

    success = exec_result["error"] is None

    # Save to history
    q = QueryHistory(
        session_id=req.session_id, question=req.question,
        sql=sql, explanation=explanation,
        result_rows=exec_result["rows"] if success else None,
        result_columns=exec_result["columns"] if success else None,
        row_count=exec_result["row_count"],
        error=exec_result["error"],
        success=success,
        execution_ms=exec_result["execution_ms"],
    )
    db.add(q)
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(q)

    return {
        "id": q.id,
        "question": req.question,
        "sql": sql,
        "explanation": explanation,
        "columns": exec_result["columns"],
        "rows": exec_result["rows"],
        "row_count": exec_result["row_count"],
        "execution_ms": exec_result["execution_ms"],
        "error": exec_result["error"],
        "success": success,
    }


@router.post("/run")
async def run_sql(req: RunSQLRequest, db: AsyncSession = Depends(get_db)):
    """Run a manually edited SQL query."""
    session = await db.get(Session, req.session_id)
    if not session:
        raise HTTPException(404)

    if session.mode == "real" and session.connection_string:
        result = await run_real_query(session.connection_string, req.sql)
    else:
        result = run_demo_query(req.sql)

    return result
