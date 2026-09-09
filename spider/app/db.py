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

# Values added to enum types that already exist in a deployed database. Same
# trap as _ADD_COLUMNS but one level worse: `create_all` creates an enum type
# only when it is missing, so a new CrawlKind member reaches production as an
# `invalid input value for enum crawl_kind` the first time a task is enqueued.
# ADD VALUE is safe inside a transaction as long as the value is not *used* in
# that same transaction (PostgreSQL 12+).
_ADD_ENUM_VALUES = (
    "ALTER TYPE crawl_kind ADD VALUE IF NOT EXISTS 'competition_stadiums'",
    "ALTER TYPE crawl_kind ADD VALUE IF NOT EXISTS 'match_detail'",
)


async def init_db() -> None:
    """Create all tables. For real migrations use Alembic; this is for dev bootstrap."""
    from app import models  # noqa: F401  ensure models are imported

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for statement in _ADD_COLUMNS:
            await conn.execute(text(statement))
        for statement in _ADD_ENUM_VALUES:
            await conn.execute(text(statement))
