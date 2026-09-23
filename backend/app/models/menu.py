from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.recipe import Recipe


class Menu(Base):
    __tablename__ = "menus"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    meals_count: Mapped[int] = mapped_column(Integer, nullable=False)  # number of meals asked for
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    items: Mapped[list["MenuItem"]] = relationship(
        "MenuItem",
        back_populates="menu",
        cascade="all, delete-orphan",
        passive_deletes=True,  # rely on ON DELETE CASCADE: no lazy load of items on delete (async)
        order_by="MenuItem.position",
    )


class MenuItem(Base):
    """A recipe of a menu, cooked once and eaten over `portions` meals."""
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True)
    # SET NULL so deleting a recipe doesn't break existing menus
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    portions: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")  # = meals covered
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    menu: Mapped["Menu"] = relationship("Menu", back_populates="items")
    recipe: Mapped["Recipe | None"] = relationship("Recipe")
