"""
Enriches a recipe's ingredients so shopping lists and macros are reliable:

1. Mistral normalizes each ingredient: canonical name ("gousses d'ail" → "ail"),
   store aisle, and estimated weight in grams of the given quantity.
2. Each ingredient is linked to a food of the ANSES-Ciqual table: the code
   pre-selects close candidates by name, Mistral picks the right one (or none).
   A Ciqual match gives the official aisle and nutrition per 100 g.
3. Optionally, the recipe's macros per serving are recomputed from Ciqual,
   only when every weighed ingredient is matched (otherwise they're kept).

Failures (Ollama down, unusable answer) never break the caller: the ingredients
just stay un-enriched and the shopping list falls back to name keywords.
"""
import json
import logging
import re
import unicodedata
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ciqual import CiqualFood
from app.models.recipe import Ingredient, Recipe
from app.services.aisles import AISLES
from app.services.shopping_list import SECTION_MARKER, normalize_unit, parse_quantity

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"
OLLAMA_TIMEOUT_SECONDS = 180.0
OLLAMA_NUM_CTX = 8192

MAX_CANDIDATES = 6
STOPWORDS = {"de", "du", "des", "d", "la", "le", "les", "l", "et", "au", "aux", "en", "a", "un", "une"}
# Dry forms, wrong for an ingredient measured as a liquid volume ("1 L de bouillon"),
# unless rehydrated ("Bouillon de volaille, déshydraté reconstitué" is the liquid)
DRY_FORM_WORDS = {"deshydrate", "deshydratee", "poudre", "lyophilise", "lyophilisee", "concentre"}
REHYDRATED_WORDS = {"reconstitue", "reconstituee"}
# State words: not part of what the food is ("Oeuf cru" is an egg), singularized like _tokens()
STATE_WORDS = {"cru", "crue", "cuit", "cuite", "frai", "fraiche", "seche", "surgele", "surgelee"}
MACRO_FIELDS = ("calories", "proteins_g", "carbs_g", "fats_g")

# Search-only synonyms (normalized tokens): names that Ciqual files under another term
_PASTA = ["pate", "seche"]
SEARCH_SYNONYMS: dict[str, list[str]] = {
    **{shape: _PASTA for shape in (
        "rigatoni", "penne", "spaghetti", "tagliatelle", "fusilli", "macaroni",
        "coquillette", "farfalle", "linguine", "conchiglie",
    )},
    "farine": ["farine", "ble"],                # plain "farine" = wheat flour
    "cottage": ["fromage", "frai", "nature"],  # "frais" once singularized
    "moret": ["fromage", "frai", "nature"],    # Saint Moret (brand)
}


# ── Ciqual index (loaded once per process) ─────────────────────────────────────

@dataclass(frozen=True)
class _IndexedFood:
    code: int
    name: str
    aisle: str
    tokens: frozenset[str]
    main_tokens: frozenset[str]  # main term, before the first comma: "Pêche, chair et peau, crue" → {peche}
    first_token: str             # "Poulet, haut de cuisse, cru" → "poulet"
    is_raw: bool
    macros: dict[str, float | None]


_ciqual_index: dict[int, _IndexedFood] = {}


def _tokens(text: str) -> list[str]:
    """Lowercase, accent-free, singular-ish tokens without stopwords."""
    text = unicodedata.normalize("NFD", text.lower().replace("œ", "oe"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    words = re.split(r"[^a-z0-9]+", text)
    return [w[:-1] if len(w) > 3 and w[-1] in "sx" else w for w in words if w and w not in STOPWORDS]


async def get_ciqual_index(db: AsyncSession) -> dict[int, _IndexedFood]:
    """The Ciqual foods, indexed for name search (empty until import_ciqual has run)."""
    if not _ciqual_index:
        for food in (await db.execute(select(CiqualFood))).scalars():
            tokens = _tokens(food.name_fr)
            _ciqual_index[food.code] = _IndexedFood(
                code=food.code,
                name=food.name_fr,
                aisle=food.aisle,
                tokens=frozenset(tokens),
                main_tokens=frozenset(_tokens(food.name_fr.split(",")[0])) - STATE_WORDS,
                first_token=tokens[0] if tokens else "",
                is_raw="cru" in tokens or "crue" in tokens,
                macros={field: getattr(food, field) for field in MACRO_FIELDS},
            )
    return _ciqual_index


def find_candidates(name: str, index: dict[int, _IndexedFood], limit: int = MAX_CANDIDATES) -> list[_IndexedFood]:
    """
    Ciqual foods whose name is close to the ingredient's: shared words, minus the
    extra words of the food's main term ("Haricot beurre" for "beurre"), a little
    for its qualifiers after the comma, with a bonus when both names start with the
    same word and a small one for raw forms (recipes list raw ingredients).
    The right food only has to be among the candidates: Mistral picks the final one.
    """
    query_tokens = [synonym for token in _tokens(name) for synonym in SEARCH_SYNONYMS.get(token, [token])]
    query = set(query_tokens)
    if not query:
        return []

    scored: list[tuple[float, _IndexedFood]] = []
    for food in index.values():
        shared = len(query & food.tokens)
        if shared == 0:
            continue
        score = (
            2 * shared / len(query)
            - 0.15 * len(food.main_tokens - query)
            - 0.02 * len(food.tokens - food.main_tokens)
            + (0.5 if food.first_token == query_tokens[0] else 0)
            + (0.1 if food.is_raw else 0)
        )
        scored.append((score, food))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [food for _, food in scored[:limit]]


# ── Mistral ────────────────────────────────────────────────────────────────────

async def _ask_ollama(prompt: str) -> list[dict]:
    """Sends a prompt expecting {"items": [...]} and returns the list of dict items."""
    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SECONDS) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"num_ctx": OLLAMA_NUM_CTX, "temperature": 0},
            },
        )
        response.raise_for_status()

    data = json.loads(response.json()["response"])
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ValueError("Ollama n'a pas retourné de liste d'éléments.")
    return [item for item in items if isinstance(item, dict)]


def _normalize_prompt(ingredients: list[Ingredient]) -> str:
    listing = [
        {"i": index, "nom": ing.name.strip(), "quantite": ing.quantity, "unite": ing.unit, "notes": ing.notes}
        for index, ing in enumerate(ingredients)
    ]
    return f"""
Tu normalises des ingrédients de recettes pour faire une liste de courses.

INGRÉDIENTS :
{json.dumps(listing, ensure_ascii=False)}

Pour CHAQUE ingrédient (même "i"), donne :
- "nom_canonique" : le nom générique de l'ingrédient tel qu'on l'achète, TOUJOURS en français (jamais en anglais),
  au singulier, sans quantité ni préparation. Exemples : "gousses d'ail" → "ail", "oignons émincés" → "oignon",
  "bœuf haché 5%" → "bœuf haché", "haut de cuisse de poulet" → "haut de cuisse de poulet",
  "jus de citron vert" → "citron vert", "ail en poudre" → "ail en poudre"
- "rayon" : UNE valeur parmi {json.dumps(list(AISLES))}
  (produce = fruits, légumes, herbes fraîches ; meat = viandes, poissons, charcuterie ;
  dairy = lait, fromages, yaourts, crème, beurre, œufs ; frozen = surgelés ; grocery = épicerie :
  pâtes, riz, farine, conserves, huiles, sauces, sucre, pain ; drinks = boissons ;
  spices = sel, poivre, épices, herbes séchées, condiments)
- "poids_unitaire_g" : le poids en grammes d'UNE SEULE unité de l'ingrédient, dans l'unité indiquée
  (ou d'une pièce s'il n'y a pas d'unité). NE multiplie PAS par la quantité. Exemples : 1 oignon ≈ 110,
  1 pêche ≈ 150, 1 gousse d'ail ≈ 5, 1 œuf ≈ 55, 1 blanc d'œuf ≈ 33, 1 tranche de pain ≈ 30,
  1 tranche de jambon ≈ 20, 1 feuille de basilic ≈ 0.5, 1 branche de romarin ≈ 2, 1 cacahuète ≈ 1.
  null s'il n'y a pas de quantité

RÉPONDS UNIQUEMENT avec un objet JSON valide :
{{"items": [{{"i": 0, "nom_canonique": "ail", "rayon": "produce", "poids_unitaire_g": 5}}]}}
""".strip()


def _match_prompt(requests: list[tuple[int, str, list[_IndexedFood]]]) -> str:
    listing = [
        {"i": index, "ingredient": name, "candidats": [{"code": f.code, "nom": f.name} for f in candidates]}
        for index, name, candidates in requests
    ]
    return f"""
Pour chaque ingrédient, choisis l'aliment de la table Ciqual qui lui correspond, parmi SES candidats.

{json.dumps(listing, ensure_ascii=False)}

RÈGLES :
- Choisis la forme crue / non préparée, sauf si l'ingrédient est explicitement cuit ou transformé
- Si la quantité est un volume de liquide (ml, cl, L), choisis la forme liquide prête à consommer,
  jamais une forme déshydratée ou en poudre
- Le candidat doit être le même aliment (pas seulement un mot en commun) ; sinon "code": null
- "code" doit être l'un des codes des candidats de CET ingrédient

RÉPONDS UNIQUEMENT avec un objet JSON valide :
{{"items": [{{"i": 0, "code": 11000}}]}}
""".strip()


def _positive_float(value: object) -> float | None:
    """A strictly positive number from untyped JSON, else None."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    return number if number > 0 else None


# Aisles Mistral sometimes answers in English instead of the listed keys
AISLE_ALIASES: dict[str, str] = {
    "herbs": "produce", "vegetables": "produce", "fruits": "produce", "fruit": "produce",
    "fish": "meat", "seafood": "meat", "eggs": "dairy", "cheese": "dairy",
    "nuts": "grocery", "bakery": "grocery", "pantry": "grocery", "condiments": "spices",
}

# Grams per unit for measures that don't depend on the ingredient (1 ml ≈ 1 g)
STANDARD_UNIT_WEIGHTS: dict[str, float] = {"g": 1, "ml": 1, "càs": 15, "càc": 5, "pincée": 0.5}


def _standard_weight(ingredient: Ingredient) -> float | None:
    """Weight in g when the unit is a mass, volume, spoon or pinch ("600 g", "10cl", "1 cas")."""
    parsed = parse_quantity(ingredient.quantity) if ingredient.quantity else None
    if not parsed:
        return None
    unit, factor = normalize_unit(ingredient.unit or parsed[1])
    grams = STANDARD_UNIT_WEIGHTS.get(unit) if unit else None
    return parsed[0] * factor * grams if grams else None


def _store_aisle(food: _IndexedFood) -> str:
    """
    Ciqual groups foods by kind, stores by how they're sold: canned vegetables are
    in the grocery aisle, dried / powdered herbs and vegetables with the spices.
    """
    if food.tokens & {"appertise", "appertisee", "conserve"}:
        return "grocery"
    if food.aisle == "produce" and food.tokens & {"poudre", "seche"}:
        return "spices"
    return food.aisle


def _is_dry_form(food: _IndexedFood) -> bool:
    return bool(food.tokens & DRY_FORM_WORDS) and not food.tokens & REHYDRATED_WORDS


def _is_liquid(ingredient: Ingredient) -> bool:
    """Whether the quantity is a volume ("1 L", "10cl")."""
    parsed = parse_quantity(ingredient.quantity) if ingredient.quantity else None
    unit, _ = normalize_unit(ingredient.unit or (parsed[1] if parsed else None))
    return unit == "ml"


def _counted_weight(ingredient: Ingredient, unit_weight: object) -> float | None:
    """Quantity × Mistral's weight of one unit ("6-8 pêches" → 8 × 150 g)."""
    parsed = parse_quantity(ingredient.quantity) if ingredient.quantity else None
    grams = _positive_float(unit_weight)
    return round(parsed[0] * grams, 1) if parsed and grams else None


# ── Enrichment ─────────────────────────────────────────────────────────────────

def is_section_marker(ingredient: Ingredient) -> bool:
    return (ingredient.notes or "").strip().lower() == SECTION_MARKER


async def _normalize(ingredients: list[Ingredient]) -> None:
    """Step 1: canonical name, aisle and weight, from one Mistral call."""
    for item in await _ask_ollama(_normalize_prompt(ingredients)):
        index = item.get("i")
        if not isinstance(index, int) or not 0 <= index < len(ingredients):
            continue
        ingredient = ingredients[index]
        canonical = item.get("nom_canonique")
        # Mistral sometimes swaps the ingredient ("cottage cheese" → "fromage de chèvre") or
        # answers in English: a canonical name must share a word with the original one
        if isinstance(canonical, str) and set(_tokens(canonical)) & set(_tokens(ingredient.name)):
            ingredient.canonical_name = canonical.strip()[:255]
        else:
            ingredient.canonical_name = ingredient.name.strip()[:255]
        aisle = item.get("rayon")
        aisle = AISLE_ALIASES.get(aisle, aisle) if isinstance(aisle, str) else None
        ingredient.aisle = aisle if aisle in AISLES else None
        ingredient.weight_g = _standard_weight(ingredient) or _counted_weight(ingredient, item.get("poids_unitaire_g"))


async def _match_ciqual(ingredients: list[Ingredient], index: dict[int, _IndexedFood]) -> None:
    """Step 2: link to a Ciqual food chosen among pre-selected candidates."""
    requests = []
    for position, ingredient in enumerate(ingredients):
        name = ingredient.canonical_name or ingredient.name
        candidates = find_candidates(name, index)
        if candidates:
            requests.append((position, name, candidates))
    if not requests:
        return

    def described(position: int, name: str) -> str:
        """The name with its quantity, so Mistral can tell "1 L de bouillon" from a powder."""
        ingredient = ingredients[position]
        amount = " ".join(p for p in (ingredient.quantity, ingredient.unit) if p)
        return f"{name} ({amount})" if amount else name

    allowed = {position: {food.code for food in candidates} for position, _, candidates in requests}
    chosen: dict[int, int] = {}
    prompt_requests = [(position, described(position, name), candidates) for position, name, candidates in requests]
    for item in await _ask_ollama(_match_prompt(prompt_requests)):
        position, raw_code = item.get("i"), item.get("code")
        code = int(raw_code) if isinstance(raw_code, (int, str)) and str(raw_code).isdigit() else None
        if position in allowed and code in allowed[position]:
            chosen[position] = code

    for position, name, candidates in requests:
        # Mistral is sometimes over-cautious: an obvious best candidate (containing every
        # word of the ingredient, e.g. "purée de tomates" → "Tomate, purée…") is taken anyway
        code = chosen.get(position)
        if code is None and set(_tokens(name)) <= candidates[0].tokens:
            code = candidates[0].code
        ingredient = ingredients[position]
        if code is not None and _is_liquid(ingredient) and _is_dry_form(index[code]):
            # Safety net: a volume of liquid never matches a dry form (its kcal/100 g are ~10× higher)
            code = next((c.code for c in candidates if not _is_dry_form(c)), None)
        if code is None:
            continue
        ingredient.ciqual_code = code
        # The official aisle wins, except for Ciqual's catch-all groups (prepared dishes…)
        if (aisle := _store_aisle(index[code])) != "other":
            ingredient.aisle = aisle


def compute_macros(recipe: Recipe, index: dict[int, _IndexedFood]) -> dict[str, float] | None:
    """
    Macros per serving from Ciqual (values per 100 g × weight). Only when every
    ingredient with a quantity is weighed and matched to a Ciqual food with values;
    ingredients without a measurable quantity ("sel", "quelques gouttes") are ignored,
    and so are spices that couldn't be weighed or matched (a pinch of paprika doesn't
    change the macros).
    """
    measured = [
        i for i in recipe.ingredients
        if i.quantity and parse_quantity(i.quantity) and not is_section_marker(i)
    ]
    if not measured:
        return None

    totals = dict.fromkeys(MACRO_FIELDS, 0.0)
    for ingredient in measured:
        food = index.get(ingredient.ciqual_code) if ingredient.ciqual_code else None
        complete = bool(ingredient.weight_g) and food is not None and food.macros["calories"] is not None
        if not complete:
            if ingredient.aisle == "spices":
                continue
            return None
        for field in MACRO_FIELDS:
            totals[field] += ingredient.weight_g * (food.macros[field] or 0) / 100

    servings = recipe.servings or 1
    return {field: round(total / servings, 1) for field, total in totals.items()}


async def enrich_recipe(recipe: Recipe, db: AsyncSession, update_macros: bool = False) -> None:
    """
    Enriches the recipe's not-yet-enriched ingredients (canonical_name is null),
    and with `update_macros`, replaces the recipe's macros by the Ciqual computation
    when it's complete. `recipe.ingredients` must be loaded. Never raises on LLM errors.
    """
    pending = [i for i in recipe.ingredients if i.canonical_name is None and not is_section_marker(i)]
    index = await get_ciqual_index(db)

    if pending:
        try:
            await _normalize(pending)
            if index:
                await _match_ciqual([i for i in pending if i.canonical_name], index)
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            logger.warning("Ingredient enrichment failed for recipe %s: %s", recipe.id, exc)

    macros = compute_macros(recipe, index) if update_macros and index else None
    if macros:
        for field, value in macros.items():
            setattr(recipe, field, value)

    await db.flush()
    if macros:
        # updated_at is set by the DB on update and expired by the flush: reload it now,
        # an implicit lazy load during serialization would fail with the async session
        await db.refresh(recipe, attribute_names=["updated_at"])


def reset_enrichment(ingredient: Ingredient) -> None:
    """Marks an ingredient as not enriched, so the next enrichment redoes it."""
    ingredient.canonical_name = None
    ingredient.aisle = None
    ingredient.weight_g = None
    ingredient.ciqual_code = None


def copy_enrichment(source: Ingredient, target: Ingredient) -> None:
    """Reuses an unchanged ingredient's enrichment (same name, quantity and unit) after an edit."""
    target.canonical_name = source.canonical_name
    target.aisle = source.aisle
    target.weight_g = source.weight_g
    target.ciqual_code = source.ciqual_code
