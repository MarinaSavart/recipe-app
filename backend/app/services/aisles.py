"""
Store aisles used to sort shopping lists. The keys are shared with the
frontend (utils/shoppingList.ts), which holds the display labels.
"""

AISLES: tuple[str, ...] = (
    "produce",   # fruits & légumes
    "meat",      # viandes & poissons
    "dairy",     # crèmerie & œufs
    "frozen",    # surgelés
    "grocery",   # épicerie
    "drinks",    # boissons
    "spices",    # épices & condiments
    "other",
)

# Ciqual sub-group code → aisle; a whole group ("04") applies when its sub-group isn't listed
_CIQUAL_AISLES: dict[str, str] = {
    "0201": "produce",   # légumes
    "0202": "produce",   # pommes de terre et autres tubercules
    "0203": "grocery",   # légumineuses
    "0204": "produce",   # fruits
    "0205": "grocery",   # fruits à coque et graines oléagineuses
    "03": "grocery",     # produits céréaliers
    "04": "meat",        # viandes, poissons…
    "0410": "dairy",     # … sauf les œufs, rangés avec la crèmerie
    "05": "dairy",       # produits laitiers
    "06": "drinks",      # eaux et autres boissons
    "07": "grocery",     # produits sucrés
    "08": "frozen",      # glaces et sorbets
    "0901": "dairy",     # beurres
    "09": "grocery",     # huiles, margarines, autres matières grasses
    "1002": "spices",    # condiments
    "1004": "spices",    # sels
    "1005": "spices",    # épices
    "1006": "produce",   # herbes
    "10": "grocery",     # sauces, aides culinaires…
}


def aisle_for_ciqual_subgroup(subgroup_code: str) -> str:
    """The store aisle of a Ciqual sub-group ("0410" → "dairy"), "other" when unmapped."""
    return _CIQUAL_AISLES.get(subgroup_code) or _CIQUAL_AISLES.get(subgroup_code[:2], "other")
