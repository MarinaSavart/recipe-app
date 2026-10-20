"""
Builds a menu's shopping list: every recipe's ingredients scaled to the
portions used in the menu (not the recipe's own servings), then merged
by ingredient (canonical name when enriched, e.g. "gousses d'ail" → "ail") and unit.
"""
import re
import unicodedata
from dataclasses import dataclass, field

from app.models.menu import MenuItem

# Unit aliases, keyed by their normalized spelling (see _unit_key) → (canonical unit, factor into it)
_SOUP_SPOON = ("càs", 1)
_TEA_SPOON = ("càc", 1)
UNIT_ALIASES: dict[str, tuple[str, float]] = {
    "g": ("g", 1),
    "gr": ("g", 1),
    "gramme": ("g", 1),
    "kg": ("g", 1000),
    "ml": ("ml", 1),
    "l": ("ml", 1000),
    "litre": ("ml", 1000),
    "cl": ("ml", 10),
    **dict.fromkeys(
        ["cas", "c a s", "cs", "cuillere a soupe", "c a soupe", "cuil a soupe", "cuillere soupe"], _SOUP_SPOON
    ),
    **dict.fromkeys(
        ["cac", "c a c", "cc", "cuillere a cafe", "c a cafe", "cuil a cafe", "cuillere cafe"], _TEA_SPOON
    ),
    "piece": ("pièce", 1),
    "gousse": ("gousse", 1),
    "tranche": ("tranches", 1),
    "feuille": ("feuilles", 1),
    "pincee": ("pincée", 1),
}

# "600", "1,5", "1/2", "1 1/2", "4-6" (upper bound kept), optionally followed by a unit,
# possibly several words ("10cl", "1 cas", "1 cuillère à soupe")
QUANTITY_RE = re.compile(
    r"^(?:(?P<whole>\d+)\s+)?(?P<num>\d+(?:[.,]\d+)?)(?:/(?P<den>\d+))?"
    r"(?:\s*-\s*(?P<upper>\d+(?:[.,]\d+)?))?"
    r"\s*(?P<unit>[^\d\s].*)?$"
)

# Section headers the recipe parser sometimes emits as fake ingredients
SECTION_MARKER = "sous-section"


@dataclass
class ShoppingLine:
    name: str
    unit: str | None
    quantity: float | None = None
    aisle: str | None = None  # from the ingredients' enrichment (Ciqual / Mistral)
    # Quantities that couldn't be parsed, kept as written ("quelques gouttes")
    extras: list[str] = field(default_factory=list)
    recipes: list[str] = field(default_factory=list)


def _unit_key(unit: str) -> str:
    """"Cuillères à café" → "cuillere a cafe", "c. à s." → "c a s", "Pièces" → "piece"."""
    decomposed = unicodedata.normalize("NFD", unit.lower())
    text = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    words = re.split(r"[\s.\-']+", text.strip())
    return " ".join(w[:-1] if len(w) > 3 and w.endswith("s") else w for w in words if w)


def normalize_unit(unit: str | None) -> tuple[str | None, float]:
    """Canonical unit and conversion factor: "kg" → ("g", 1000), "cuillère à soupe" → ("càs", 1)."""
    if not unit or not unit.strip():
        return None, 1
    return UNIT_ALIASES.get(_unit_key(unit), (unit.strip().lower(), 1))


def parse_quantity(raw: str) -> tuple[float, str | None] | None:
    """Parses a free-text quantity into (number, unit found in the text), or None."""
    match = QUANTITY_RE.match(raw.strip().lower())
    if not match:
        return None

    def number(text: str) -> float:
        return float(text.replace(",", "."))

    value = number(match["upper"] or match["num"])
    if match["den"] and not match["upper"]:
        denominator = int(match["den"])
        if denominator == 0:
            return None
        value /= denominator
    if match["whole"]:
        value += int(match["whole"])
    return value, match["unit"]


def _merge_key(name: str) -> str:
    """Case- and accent-insensitive key: "Pêche" and "peche" are the same line."""
    decomposed = unicodedata.normalize("NFD", name.lower().replace("œ", "oe"))
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def build_shopping_list(items: list[MenuItem]) -> list[ShoppingLine]:
    """
    Merges the ingredients of the menu's recipes, each scaled by
    portions in the menu ÷ servings of the recipe (1 when unknown).
    Items must have `recipe.ingredients` loaded.
    """
    lines: dict[tuple[str, str | None], ShoppingLine] = {}

    for item in items:
        recipe = item.recipe
        if recipe is None:
            continue
        factor = item.portions / (recipe.servings or 1)

        for ingredient in recipe.ingredients:
            name = (ingredient.canonical_name or ingredient.name).strip()
            if not name or (ingredient.notes or "").strip().lower() == SECTION_MARKER:
                continue

            parsed = parse_quantity(ingredient.quantity) if ingredient.quantity else None
            unit_text = ingredient.unit or (parsed[1] if parsed else None)
            unit, unit_factor = normalize_unit(unit_text)

            key = (_merge_key(name), unit)
            line = lines.setdefault(key, ShoppingLine(name=name, unit=unit))
            line.aisle = line.aisle or ingredient.aisle
            if recipe.title not in line.recipes:
                line.recipes.append(recipe.title)

            if parsed:
                line.quantity = (line.quantity or 0) + parsed[0] * unit_factor * factor
            elif ingredient.quantity and ingredient.quantity.strip():
                extra = " ".join(p for p in (ingredient.quantity.strip(), ingredient.unit) if p)
                if extra not in line.extras:
                    line.extras.append(extra)

    return sorted(lines.values(), key=lambda line: line.name.lower())
