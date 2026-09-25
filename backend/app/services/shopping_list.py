"""
Builds a menu's shopping list: every recipe's ingredients scaled to the
portions used in the menu (not the recipe's own servings), then merged
by ingredient name and unit.
"""
import re
from dataclasses import dataclass, field

from app.models.menu import MenuItem

# Unit aliases → (canonical unit, factor to convert into it)
UNIT_ALIASES: dict[str, tuple[str, float]] = {
    "kg": ("g", 1000),
    "l": ("ml", 1000),
    "cl": ("ml", 10),
    "cas": ("càs", 1),
    "c.a.s": ("càs", 1),
    "cac": ("càc", 1),
    "c.a.c": ("càc", 1),
    "pièces": ("pièce", 1),
    "gousses": ("gousse", 1),
    "tranche": ("tranches", 1),
    "feuille": ("feuilles", 1),
}

# "600", "1,5", "1/2", "1 1/2", "4-6" (upper bound kept), optionally followed by a unit ("10cl", "1 cas")
QUANTITY_RE = re.compile(
    r"^(?:(?P<whole>\d+)\s+)?(?P<num>\d+(?:[.,]\d+)?)(?:/(?P<den>\d+))?"
    r"(?:\s*-\s*(?P<upper>\d+(?:[.,]\d+)?))?"
    r"\s*(?P<unit>[^\d\s][\w.]*)?$"
)

# Section headers the recipe parser sometimes emits as fake ingredients
SECTION_MARKER = "sous-section"


@dataclass
class ShoppingLine:
    name: str
    unit: str | None
    quantity: float | None = None
    # Quantities that couldn't be parsed, kept as written ("quelques gouttes")
    extras: list[str] = field(default_factory=list)
    recipes: list[str] = field(default_factory=list)


def _normalize_unit(unit: str | None) -> tuple[str | None, float]:
    if not unit or not unit.strip():
        return None, 1
    key = unit.strip().lower().rstrip(".")
    return UNIT_ALIASES.get(key, (key, 1))


def _parse_quantity(raw: str) -> tuple[float, str | None] | None:
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
            name = ingredient.name.strip()
            if not name or (ingredient.notes or "").strip().lower() == SECTION_MARKER:
                continue

            parsed = _parse_quantity(ingredient.quantity) if ingredient.quantity else None
            unit_text = ingredient.unit or (parsed[1] if parsed else None)
            unit, unit_factor = _normalize_unit(unit_text)

            key = (name.lower(), unit)
            line = lines.setdefault(key, ShoppingLine(name=name, unit=unit))
            if recipe.title not in line.recipes:
                line.recipes.append(recipe.title)

            if parsed:
                line.quantity = (line.quantity or 0) + parsed[0] * unit_factor * factor
            elif ingredient.quantity and ingredient.quantity.strip():
                extra = " ".join(p for p in (ingredient.quantity.strip(), ingredient.unit) if p)
                if extra not in line.extras:
                    line.extras.append(extra)

    return sorted(lines.values(), key=lambda line: line.name.lower())
