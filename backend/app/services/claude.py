import json

import httpx

from app.schemas.recipe import IngredientCreate, RecipeCreate, StepCreate

# Ollama tourne en local sur ce port par défaut
OLLAMA_URL = "http://host.docker.internal:11434/api/generate"
OLLAMA_MODEL = "mistral"

# ── Prompt système ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
Tu es un parseur de recettes de cuisine. Tu extrais les données d'une description et tu retournes UNIQUEMENT un objet JSON.

RÈGLE ABSOLUE : Retourne UNIQUEMENT le JSON. Zéro texte avant. Zéro texte après. Zéro explication.

Structure JSON obligatoire :
{
  "title": "string",
  "description": null,
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
  ],
  "tags": ["tag1", "tag2", "tag3"]
}

RÈGLES INGREDIENTS :
- Extrais TOUS les ingrédients sans exception, y compris ceux des sous-sections (Sauce, Marinade, Garniture, Poulet, Salade...)
- Pour chaque sous-section, ajoute le nom de la section dans "notes" (ex: "sauce", "marinade", "poulet")
- Ingrédients comptables sans unité (1 oeuf, 2 carottes) : quantity="1", unit=null
- quantity est TOUJOURS une string
- Traduis TOUT en français
- Ramène TOUTES les quantités à 1 portion en divisant par le nombre de portions total
  Cette règle s'applique à TOUS les ingrédients sans exception, y compris les cas, cac, ml, g, kg...
  Exemple : si la recette est pour 4 portions et qu'il faut 800g de poulet, mets quantity="200"
  Exemple : si la recette est pour 3 portions et qu'il faut 1 oeuf, mets quantity="0.33"
  Exemple : si la recette est pour 3 portions, et qu'il faut 1 cas paprika → quantity="0.33"
  Exemple : si la recette est pour 3 portions, et qu'il faut 2 cas sauce soja → quantity="0.67"
  Ne jamais laisser une quantité non divisée si la recette est pour plusieurs portions.


RÈGLES ÉTAPES :
- Extrais TOUTES les étapes sans exception
- Chaque tiret "-" ou point de la recette = une étape séparée
- Retranscris le contenu COMPLET de chaque étape, sans raccourcir
- duration_minutes uniquement si un temps est explicitement mentionné

RÈGLES GÉNÉRALES :
- Traduis tout en français (ingrédients, étapes, titre, tags)
- Si une info est absente : null
- tags : 3 à 6 mots-clés pertinents
""".strip()


# ── Fonction principale ────────────────────────────────────────────────────────
async def parse_recipe(raw_description: str, suggested_title: str | None = None) -> RecipeCreate:
    """
    Envoie la description à Ollama (llama3.2 en local) et retourne
    une RecipeCreate prête à être sauvegardée en base.
    """

    # On combine le prompt système et le contenu utilisateur en un seul prompt
    # car Ollama en mode /api/generate n'a pas de system/user séparés
    user_content = raw_description
    if suggested_title:
        user_content = f"Titre de la video : {suggested_title}\n\n{raw_description}"

    full_prompt = f"{SYSTEM_PROMPT}\n\nVoici la description à parser :\n\n{user_content}"

    # Appel à Ollama — stream:false pour attendre la réponse complète
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": full_prompt,
                "stream": False,        # on veut la réponse en une fois
                "format": "json",       # force Ollama à retourner du JSON valide
            }
        )
        response.raise_for_status()

    result = response.json()
    raw_json = result["response"].strip()

    # Nettoyage des backticks au cas où
    if raw_json.startswith("```"):
        raw_json = raw_json.split("```")[1]
        if raw_json.startswith("json"):
            raw_json = raw_json[4:]
        raw_json = raw_json.strip()

    data = json.loads(raw_json)

    # Convertit les listes en objets Pydantic
    ingredients = [IngredientCreate(**ing) for ing in data.get("ingredients", [])]
    steps = [StepCreate(**step) for step in data.get("steps", [])]

    return RecipeCreate(
        title=data["title"],
        description=data.get("description"),
        servings=data.get("servings"),
        prep_time_minutes=data.get("prep_time_minutes"),
        cook_time_minutes=data.get("cook_time_minutes"),
        calories=data.get("calories"),
        proteins_g=data.get("proteins_g"),
        carbs_g=data.get("carbs_g"),
        fats_g=data.get("fats_g"),
        ingredients=ingredients,
        steps=steps,
        tags=data.get("tags", []),
        raw_description=raw_description,
    )