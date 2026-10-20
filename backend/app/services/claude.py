import json

import httpx

from app.config import settings
from app.schemas.recipe import IngredientCreate, RecipeCreate, StepCreate

# OpenRouter exposes an OpenAI-compatible chat completions API
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
Tu es un parseur de recettes de cuisine. Tu extrais les données d'une description et tu retournes UNIQUEMENT un objet JSON.

RÈGLE ABSOLUE : Retourne UNIQUEMENT le JSON. Zéro texte avant. Zéro texte après. Zéro explication.

Structure JSON obligatoire :
{
  "title": "string",
  "description": null,
  "category": "breakfast" | "repas" | "collation" | "dessert" | "snack" | "boisson" | null,
  "servings": 3,
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "calories": 340,
  "proteins_g": 45,
  "carbs_g": 30,
  "fats_g": 9,
  "ingredients": [
    { "position": 0, "name": "blanc de poulet", "quantity": "600", "unit": "g", "notes": null },
    { "position": 1, "name": "oeuf", "quantity": "1", "unit": null, "notes": null },
    { "position": 2, "name": "sauce soja", "quantity": "2", "unit": "cas", "notes": "sauce" }
  ],
  "steps": [
    { "position": 0, "content": "Texte complet de l étape.", "duration_minutes": 10 },
    { "position": 1, "content": "Texte complet de l étape suivante.", "duration_minutes": null }
  ]
}

RÈGLES CATÉGORIE :
- Déduire la catégorie depuis le contenu de la recette
- Valeurs autorisées uniquement : "breakfast", "repas", "collation", "dessert", "snack", "boisson"
- Si aucune catégorie ne correspond clairement : null
- Une seule catégorie par recette

RÈGLES INGREDIENTS :
- Extrais TOUS les ingrédients sans exception, y compris ceux des sous-sections (Sauce, Marinade, Garniture, Poulet, Salade...)
- Pour chaque sous-section, ajoute le nom de la section dans "notes" (ex: "sauce", "marinade", "poulet")
- Ingrédients comptables sans unité (1 oeuf, 2 carottes) : quantity="1", unit=null
- quantity est TOUJOURS une string
- Traduis TOUT en français


RÈGLES ÉTAPES :
- Extrais TOUTES les étapes sans exception
- Chaque tiret "-" ou point de la recette = une étape séparée
- Retranscris le contenu COMPLET de chaque étape, sans raccourcir
- duration_minutes uniquement si un temps est explicitement mentionné

RÈGLES GÉNÉRALES :
- Traduis tout en français (ingrédients, étapes, titre)
- Si une info est absente : null
""".strip()


# ── Main function ──────────────────────────────────────────────────────────────
async def parse_recipe(raw_description: str, suggested_title: str | None = None) -> RecipeCreate:
    """
    Sends the description to OpenRouter and returns
    a RecipeCreate ready to be saved to the database.
    """

    user_content = raw_description
    if suggested_title:
        user_content = f"Titre de la video : {suggested_title}\n\n{raw_description}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                # Recommended by OpenRouter to identify the app
                "HTTP-Referer": "https://mise-en-bouche.app",
                "X-Title": "Mise en Bouche",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "response_format": {"type": "json_object"},  # forces valid JSON
                "temperature": 0.1,  # structured parsing → low temperature
            },
        )
        response.raise_for_status()

    result = response.json()
    raw_json = result["choices"][0]["message"]["content"].strip()

    # Strip backticks just in case
    if raw_json.startswith("```"):
        raw_json = raw_json.split("```")[1]
        if raw_json.startswith("json"):
            raw_json = raw_json[4:]
        raw_json = raw_json.strip()

    data = json.loads(raw_json)

    # Convert the lists into Pydantic objects
    ingredients = [IngredientCreate(**ing) for ing in data.get("ingredients", [])]
    steps = [StepCreate(**step) for step in data.get("steps", [])]

    return RecipeCreate(
        title=data["title"],
        description=data.get("description"),
        category=data.get("category"),
        servings=data.get("servings"),
        prep_time_minutes=data.get("prep_time_minutes"),
        cook_time_minutes=data.get("cook_time_minutes"),
        calories=data.get("calories"),
        proteins_g=data.get("proteins_g"),
        carbs_g=data.get("carbs_g"),
        fats_g=data.get("fats_g"),
        ingredients=ingredients,
        steps=steps,
        raw_description=raw_description,
    )