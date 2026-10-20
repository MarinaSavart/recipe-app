from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserGoals
from app.schemas.user import UserGoalsUpdate

# Used for menu generation when the user hasn't defined their goals yet
DEFAULT_GOALS: dict[str, float] = {
    "calories": 2000,
    "proteins_g": 150,
    "carbs_g": 220,
    "fats_g": 65,
}


async def get_goals(user_id: int, db: AsyncSession) -> UserGoals | None:
    """Returns the user's saved goals, or None if they never saved any."""
    result = await db.execute(select(UserGoals).where(UserGoals.user_id == user_id))
    return result.scalar_one_or_none()


async def upsert_goals(user_id: int, payload: UserGoalsUpdate, db: AsyncSession) -> UserGoals:
    """Creates or fully replaces the user's goals."""
    goals = await get_goals(user_id, db)
    if goals is None:
        goals = UserGoals(user_id=user_id)
        db.add(goals)

    for field, value in payload.model_dump().items():
        setattr(goals, field, value)

    await db.flush()
    return goals


async def get_daily_targets(user_id: int, db: AsyncSession) -> dict[str, float]:
    """
    Daily macro targets used for menu generation: the user's saved values,
    with defaults filling any missing field.
    """
    goals = await get_goals(user_id, db)
    if goals is None:
        return dict(DEFAULT_GOALS)

    return {
        field: value if (value := getattr(goals, field)) is not None else default
        for field, default in DEFAULT_GOALS.items()
    }


async def get_meal_targets(user_id: int, db: AsyncSession) -> dict[str, float]:
    """Macro targets for a single meal: the daily targets divided by the meals per day."""
    goals = await get_goals(user_id, db)
    meals_per_day = goals.meals_per_day if goals else 3
    daily = await get_daily_targets(user_id, db)
    return {field: round(value / meals_per_day) for field, value in daily.items()}
