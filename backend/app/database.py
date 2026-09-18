from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Le moteur de connexion à la base de données PostgreSQL 
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

# La "factory" de session — on utilise pour ouvir une session à la base de données
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Classe de base dont hériteront tous les modèles Sqlalchemy
class Base(DeclarativeBase):
    pass

# Dépendance FastAPI — injectée dans chaque endpoint qui a besoin de la DB
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception: 
            await session.rollback()
            raise