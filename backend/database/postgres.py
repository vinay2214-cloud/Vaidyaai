import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import settings

logger = logging.getLogger("vaidyaai.database.postgres")

Base = declarative_base()

# Configure SQLAlchemy 2.0 async engine with explicit connection pool limits for Cloud SQL.
_engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}

# The SQLite dev fallback (aiosqlite) runs on NullPool and rejects the Cloud SQL
# pool-sizing arguments; only apply them for real pooled databases like PostgreSQL.
if not settings.DATABASE_URL.strip().lower().startswith("sqlite"):
    _engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
    })

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# Async session factory
AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def init_db():
    """Initialize the relational store.

    In development we auto-create tables from the ORM metadata for convenience.
    In every other environment the schema is owned by Alembic migrations
    (``alembic upgrade head``) so we never silently diverge from version control.
    """
    if settings.is_development:
        logger.info("Development environment: creating tables from ORM metadata...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("PostgreSQL tables checked/created (development)")
    else:
        logger.info("Non-development environment: schema managed by Alembic migrations; skipping create_all.")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
