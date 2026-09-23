from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.models import recipe as recipe_models  # noqa: F401 — import needed so Base "sees" the models
from app.routers.recipes import router as recipes_router

from app.routers.auth import router as auth_router
from app.models import user as user_models  # noqa: F401
from app.models import menu as menu_models  # noqa: F401
from app.routers.menus import router as menus_router
from app.routers.users import router as users_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Code executed on server startup and shutdown.
    Creates the SQL tables if they don't exist yet.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # cleanup on shutdown could be added here (closing connections, etc.)


app = FastAPI(
    title="Recipe App API",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allows the frontend (Vite on :5173 or CRA on :3000) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves uploaded images at /uploads/file-name.jpg
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(recipes_router)
app.include_router(auth_router)
app.include_router(menus_router)
app.include_router(users_router)

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Simple endpoint to check that the server is running."""
    return {"status": "ok"}