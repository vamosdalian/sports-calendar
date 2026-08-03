from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


# Columns added to tables that already exist in a deployed database.
# `create_all` only ever creates missing *tables*, so a new column on an
# existing model would silently never reach production without this.
_ADD_COLUMNS = (
    "ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS "
    "kickoff_time_tbd BOOLEAN NOT NULL DEFAULT FALSE",
)


async def init_db() -> None:
    """Create all tables. For real migrations use Alembic; this is for dev bootstrap."""
    from app import models  # noqa: F401  ensure models are imported

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for statement in _ADD_COLUMNS:
            await conn.execute(text(statement))
