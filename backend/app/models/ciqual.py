from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CiqualFood(Base):
    """
    A food of the ANSES-Ciqual table (French food composition reference),
    loaded by `python -m app.scripts.import_ciqual`. Values are per 100 g.
    Source: Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.
    https://doi.org/10.57745/RDMHWY — Etalab Open Licence 2.0.
    """
    __tablename__ = "ciqual_foods"

    code: Mapped[int] = mapped_column(Integer, primary_key=True)  # Ciqual alim_code
    name_fr: Mapped[str] = mapped_column(String(255), nullable=False)
    subgroup_code: Mapped[str] = mapped_column(String(4), nullable=False)
    subgroup_name: Mapped[str] = mapped_column(String(255), nullable=False)
    aisle: Mapped[str] = mapped_column(String(20), nullable=False)  # store aisle derived from the subgroup

    # Per 100 g, null when Ciqual has no value
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    proteins_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fats_g: Mapped[float | None] = mapped_column(Float, nullable=True)
