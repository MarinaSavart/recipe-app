from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.models import recipe as recipe_models  # noqa: F401 — import nécessaire pour que Base "voit" les modèles
from app.routers.recipes import router as recipes_router

from app.routers.auth import router as auth_router
from app.models import user as user_models  # noqa: F401

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Code exécuté au démarrage et à l'arrêt du serveur.
    On crée les tables SQL si elles n'existent pas encore.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # ici on pourrait ajouter du cleanup à l'arrêt (fermer des connexions, etc.)


app = FastAPI(
    title="Recipe App API",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Autorise le front (Vite sur :5173 ou CRA sur :3000) à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sert les images uploadées sur /uploads/nom-du-fichier.jpg
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(recipes_router)
app.include_router(auth_router)

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Endpoint simple pour vérifier que le serveur tourne."""
    return {"status": "ok"}