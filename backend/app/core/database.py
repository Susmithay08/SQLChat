from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Boolean
from datetime import datetime, timezone
import uuid
from app.core.config import settings


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, default="New Chat")
    mode = Column(String, default="demo")          # demo | real
    connection_string = Column(String, nullable=True)
    db_type = Column(String, nullable=True)        # postgresql | mysql | sqlite
    schema_snapshot = Column(JSON, nullable=True)  # cached schema info
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class QueryHistory(Base):
    __tablename__ = "query_history"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=False, index=True)
    question = Column(Text, nullable=False)
    sql = Column(Text, nullable=True)
    result_rows = Column(JSON, nullable=True)
    result_columns = Column(JSON, nullable=True)
    row_count = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    success = Column(Boolean, default=True)
    explanation = Column(Text, nullable=True)
    execution_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
