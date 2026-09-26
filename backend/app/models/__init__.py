# Importing every model module here registers all tables on Base.metadata
# (needed by Alembic autogenerate and create_all).
from app.models import ciqual, menu, recipe, user  # noqa: F401
