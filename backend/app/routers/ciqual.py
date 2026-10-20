from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ciqual import CiqualFoodOut
from app.services import ingredient_enrichment as enrichment_service

router = APIRouter(prefix="/ciqual", tags=["ciqual"])


@router.get("/search", response_model=list[CiqualFoodOut])
async def search_foods(
    q: str = Query(min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ciqual foods matching an ingredient name (autocomplete of the recipe edit form),
    best matches first. Source: Anses. 2025. Table Ciqual — Etalab Open Licence 2.0.
    """
    return await enrichment_service.search_foods(q, db)
