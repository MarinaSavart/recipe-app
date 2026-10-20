from pydantic import BaseModel


class CiqualFoodOut(BaseModel):
    """A food of the ANSES-Ciqual table, as linked to an ingredient or suggested in search."""
    code: int
    name_fr: str
    aisle: str  # store aisle key (see app/services/aisles.py)
    model_config = {"from_attributes": True}
