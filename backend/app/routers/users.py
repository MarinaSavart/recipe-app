from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserGoalsOut, UserGoalsUpdate
from app.services import user_goals as goals_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/goals", response_model=UserGoalsOut | None)
async def get_my_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's nutritional goals, or null if they never saved any."""
    return await goals_service.get_goals(current_user.id, db)


@router.put("/me/goals", response_model=UserGoalsOut)
async def save_my_goals(
    payload: UserGoalsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates or replaces the current user's nutritional goals."""
    return await goals_service.upsert_goals(current_user.id, payload, db)
