from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Connection engine to the PostgreSQL database
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# Session factory — used to open a database session
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class that all SQLAlchemy models inherit from
class Base(DeclarativeBase):
    pass

# FastAPI dependency — injected into every endpoint that needs the DB
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception: 
            await session.rollback()
            raise