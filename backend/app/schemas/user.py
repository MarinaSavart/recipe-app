from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    token: str  # the Google token returned by the frontend


class UserOut(BaseModel):
    id: int
    email: str
    name: str | None
    avatar_url: str | None
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ── Nutritional goals ──────────────────────────────────────────────────────────

class UserGoalsBase(BaseModel):
    calories: float | None = Field(default=None, ge=0)
    proteins_g: float | None = Field(default=None, ge=0)
    carbs_g: float | None = Field(default=None, ge=0)
    fats_g: float | None = Field(default=None, ge=0)
    meals_per_day: int = Field(default=3, ge=1, le=6)


class UserGoalsUpdate(UserGoalsBase):
    pass


class UserGoalsOut(UserGoalsBase):
    model_config = {"from_attributes": True}
