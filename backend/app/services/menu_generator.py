"""
Generates a menu by asking Ollama/Mistral to pick recipes covering
a number of meals, close to the user's per-meal nutritional goals.

A recipe is cooked whole: a recipe yielding N portions covers N meals
(or 2N, 3N...). Mistral doesn't count reliably, so its answer is then
fixed deterministically to cover exactly the requested number of meals.
"""
import json
import logging

import httpx

from app.schemas.menu import MenuGenerateRequest

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"

OLLAMA_TIMEOUT_SECONDS = 300.0
# Ollama's default context window is too small for the recipe list
OLLAMA_NUM_CTX = 8192


def _build_prompt(
    request: MenuGenerateRequest,
    available_recipes: list[dict],
    meal_targets: dict[str, float],
) -> str:
    return f"""
Tu es un nutritionniste. Tu dois composer un menu de {request.meals_count} repas
en choisissant parmi les recettes disponibles, au plus près des objectifs nutritionnels.

OBJECTIFS NUTRITIONNELS PAR REPAS :
{json.dumps(meal_targets, ensure_ascii=False)}

RECETTES DISPONIBLES (macros par portion ; "portions" = nombre de portions que produit la recette) :
{json.dumps(available_recipes, ensure_ascii=False)}

RÈGLES :
- Une portion = un repas. Une recette est cuisinée en entier : une recette à N portions
  couvre N repas (ou 2N, 3N... si tu la cuisines plusieurs fois)
- "portions" de chaque élément = nombre de repas couverts par cette recette, multiple de ses portions
- La somme des "portions" doit être exactement {request.meals_count}
- N'utilise QUE des recipe_id présents dans la liste
- Choisis des recettes dont les macros par portion sont proches des objectifs par repas (±15%)
- Varie les recettes autant que possible

RÉPONDS UNIQUEMENT avec un objet JSON valide, aucun texte avant ou après :
{{"items": [
  {{"recipe_id": 12, "portions": 3}},
  {{"recipe_id": 5, "portions": 2}}
]}}
""".strip()


def _extract_items(data: object) -> list[object]:
    """
    Ollama's "format": "json" mode forces a JSON *object*, so the array usually
    comes wrapped (e.g. {"items": [...]}); accept a bare array too.
    """
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list):
                return value
    raise ValueError("Ollama n'a pas retourné un tableau JSON valide.")


def _batch_size(recipe: dict) -> int:
    """Portions produced by cooking the recipe once (1 when unknown)."""
    return max(1, recipe.get("portions") or 1)


def _sanitize_choices(raw_items: list[object], recipes_by_id: dict[int, dict]) -> dict[int, int]:
    """
    Keeps known recipes, merges duplicates and rounds each recipe's portions
    to the nearest whole number of batches (at least one).
    Returns {recipe_id: portions}, in Ollama's order.
    """
    requested: dict[int, float] = {}
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        try:
            recipe_id = int(raw["recipe_id"])
            portions = float(raw.get("portions") or 0)
        except (KeyError, TypeError, ValueError):
            continue
        if recipe_id in recipes_by_id:
            requested[recipe_id] = requested.get(recipe_id, 0) + max(0.0, portions)

    choices: dict[int, int] = {}
    for recipe_id, portions in requested.items():
        batch = _batch_size(recipes_by_id[recipe_id])
        choices[recipe_id] = max(1, round(portions / batch)) * batch
    return choices


def _fit_to_meals_count(
    choices: dict[int, int],
    recipes_by_id: dict[int, dict],
    target: int,
    target_calories: float,
) -> dict[int, int]:
    """
    Builds the final choices, only by whole batches, so they cover exactly `target`
    meals (or the closest count below it if batch sizes can't add up to it).
    Ollama's batches are kept in its order as long as the remaining meals can still
    be completed; the rest is filled with new recipes first, closest to the
    per-meal calories.
    """
    def batch(recipe_id: int) -> int:
        return _batch_size(recipes_by_id[recipe_id])

    # Meal counts reachable by combining batches of the available recipes (coin change)
    batch_sizes = {batch(rid) for rid in recipes_by_id}
    reachable = [True] + [False] * target
    for n in range(1, target + 1):
        reachable[n] = any(size <= n and reachable[n - size] for size in batch_sizes)

    # Invariant: the remaining meal count is always reachable, so filling always succeeds
    remaining = max(n for n in range(target + 1) if reachable[n])
    fitted: dict[int, int] = {}

    def fits(recipe_id: int) -> bool:
        return batch(recipe_id) <= remaining and reachable[remaining - batch(recipe_id)]

    def add_batch(recipe_id: int) -> None:
        nonlocal remaining
        fitted[recipe_id] = fitted.get(recipe_id, 0) + batch(recipe_id)
        remaining -= batch(recipe_id)

    for recipe_id, portions in choices.items():
        for _ in range(portions // batch(recipe_id)):
            if fits(recipe_id):
                add_batch(recipe_id)

    while remaining > 0:
        add_batch(min(
            (rid for rid in recipes_by_id if fits(rid)),
            key=lambda rid: (
                rid in fitted,  # new recipes first, for variety
                abs((recipes_by_id[rid].get("calories") or target_calories) - target_calories),
            ),
        ))

    return fitted


async def generate_menu(
    request: MenuGenerateRequest,
    available_recipes: list[dict],     # [{"id": 1, "title": "...", "portions": 3, "calories": 340, ...}]
    meal_targets: dict[str, float],    # {"calories": 600, "proteins_g": 45, ...}
) -> list[dict]:
    """
    Asks Ollama to pick recipes for `request.meals_count` meals.
    Returns the menu items: [{"recipe_id": 3, "portions": 3, "position": 0}, ...]
    Raises ValueError if Ollama's answer is unusable.
    """
    if not available_recipes:
        raise ValueError("Aucune recette de catégorie « repas » pour composer un menu.")

    prompt = _build_prompt(request, available_recipes, meal_targets)

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SECONDS) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"num_ctx": OLLAMA_NUM_CTX},
            },
        )
        response.raise_for_status()

    raw = response.json()["response"].strip()

    # Strip backticks just in case
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Ollama n'a pas retourné un JSON valide.") from exc

    recipes_by_id = {recipe["id"]: recipe for recipe in available_recipes}
    choices = _sanitize_choices(_extract_items(data), recipes_by_id)
    choices = _fit_to_meals_count(
        choices, recipes_by_id, request.meals_count, meal_targets.get("calories", 0)
    )

    if not choices:
        raise ValueError("Impossible de composer un menu avec ces recettes.")

    logger.info("Menu generated: %d recipes, %d meals", len(choices), sum(choices.values()))
    return [
        {"recipe_id": recipe_id, "portions": portions, "position": position}
        for position, (recipe_id, portions) in enumerate(choices.items())
    ]
