# Backend — FastAPI

## ⚠️ Comportement par défaut

* **Ne pas écrire de tests** sauf demande explicite
* **Ne pas ajouter de dépendances** dans `requirements.txt` sauf demande explicite
* **Ne pas modifier le schéma SQL** sans migration Alembic explicitement demandée
* **Ne pas reformater** les fichiers non touchés par la tâche
* **Ne pas modifier les fichiers de configuration** sans raison explicite liée à la tâche

---

## Stack

* Python 3.13
* FastAPI
* Uvicorn
* SQLAlchemy 2.x avec API asyncio
* PostgreSQL 16
* asyncpg
* Alembic
* Pydantic v2
* Ollama / Mistral pour le parsing des recettes
* yt-dlp pour l'extraction de métadonnées Instagram/TikTok
* bcrypt pour le hashage des mots de passe
* JWT pour l'authentification

### LLM

* Ollama/Mistral est le moteur LLM actuellement utilisé
* `anthropic` est disponible pour une éventuelle intégration future avec Claude API
* Ne pas remplacer Ollama/Mistral par Claude API sans demande explicite

---

## Lancer

```bash
venv\Scripts\activate
uvicorn app.main:app --reload
```

---

## Architecture

```text
app/

├── main.py              # Point d'entrée FastAPI + CORS + lifespan
├── config.py            # Variables d'environnement (.env)
├── database.py          # Engine PostgreSQL async + session
├── dependencies.py      # Dépendances FastAPI (auth, DB...)
│
├── models/
│   ├── recipe.py        # SQLAlchemy models recettes
│   └── user.py          # SQLAlchemy model utilisateur
│
├── schemas/
│   ├── recipe.py        # Pydantic I/O recettes
│   └── user.py          # Pydantic I/O auth
│
├── services/
│   ├── extractor.py     # Wrapper yt-dlp
│   ├── claude.py        # Ollama/Mistral parsing description → JSON
│   └── auth.py          # bcrypt + JWT
│
└── routers/
    ├── recipes.py       # CRUD + import endpoints
    └── auth.py          # register, login, /me
```

---

## Règles importantes

### Base de données

* Les colonnes SQL utilisent `snake_case`
* `proteins_g`, `carbs_g`, `fats_g` sont les noms définitifs actuellement utilisés en base
* Toute modification du schéma DB doit passer par une migration Alembic
* Ne jamais modifier directement le schéma DB pour contourner une migration
* Les migrations autogénérées doivent toujours être relues et validées manuellement
* Utiliser `await db.flush()` lorsqu'un identifiant généré par la DB est nécessaire avant le commit

### Transactions

* **Convention du projet :** les services ne font pas `db.commit()`
* `get_db()` est responsable de la gestion de la transaction
* Ne pas dupliquer la gestion du commit/rollback dans les services
* Cette convention doit être respectée tant que `get_db()` assure effectivement cette responsabilité

### Async

* Utiliser `async def` pour les endpoints qui effectuent des opérations async
* Utiliser `await` pour les opérations DB avec `AsyncSession`
* Ne jamais exécuter d'I/O bloquante directement dans un endpoint `async def`
* Le code bloquant comme yt-dlp ou certaines opérations fichier doit être délégué à `asyncio.to_thread()` ou à un executor approprié
* Ne pas utiliser `time.sleep()` dans du code async
* Utiliser `asyncio.gather()` uniquement lorsque les opérations sont réellement indépendantes et peuvent être exécutées en parallèle

### Sécurité

* Les mots de passe sont hashés avec bcrypt
* Ne jamais stocker un mot de passe en clair
* Les tokens JWT sont signés avec `SECRET_KEY` provenant de `.env`
* Ne jamais logger de mot de passe, token, cookie ou secret
* Ne jamais hardcoder de secret dans le code
* Ne jamais commiter `.env` ou des fichiers contenant des secrets

### CORS

* CORS est configuré pour les origines de développement prévues par le projet
* Ne pas élargir les origines autorisées sans raison explicite
* Ne pas utiliser `allow_origins=["*"]` pour contourner un problème CORS

---

## Variables d'environnement

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/recipes

SECRET_KEY=...

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=10080

GOOGLE_CLIENT_ID=              # optionnel

ANTHROPIC_API_KEY=             # optionnel — uniquement si Claude API est utilisé
```

---

# Bonnes pratiques Python 3.13 + FastAPI

## Typage

* Type hints obligatoires sur les paramètres et valeurs de retour des fonctions publiques
* Utiliser la syntaxe moderne Python 3.10+
* `str | None` plutôt que `Optional[str]`
* `list[str]` plutôt que `List[str]`
* `dict[str, int]` plutôt que `Dict[str, int]`
* Éviter `Any`
* Utiliser `Any` uniquement lorsqu'il est réellement nécessaire et documenter pourquoi
* Préférer des types précis ou `object` / `unknown`-like patterns adaptés à Python lorsque possible

```python
# ❌ Ancien

from typing import Optional, List

def get_recipes(limit: Optional[int] = None) -> List[Recipe]:
    ...


# ✅ Moderne

def get_recipes(limit: int | None = None) -> list[Recipe]:
    ...
```

---

## Async

* Utiliser `async def` lorsqu'un endpoint ou une fonction doit `await` une opération asynchrone
* Ne jamais bloquer la boucle asyncio avec des opérations synchrones coûteuses ou bloquantes
* Utiliser `asyncio.to_thread()` pour les fonctions synchrones bloquantes simples
* Utiliser un executor dédié lorsque le contrôle du pool d'exécution est nécessaire
* Les opérations DB utilisant `AsyncSession` doivent être awaitées

```python
# ❌ Bloquant

@router.get("/")
async def list_recipes():
    time.sleep(1)
    ...


# ✅ Thread séparé

result = await asyncio.to_thread(blocking_function, argument)
```

---

## FastAPI — Endpoints

* Un endpoint = une responsabilité
* Les endpoints orchestrent les opérations ; la logique métier va dans `services/`
* Utiliser `Depends()` pour les dépendances DB, auth, etc.
* Définir explicitement `response_model` sur les endpoints publics lorsque cela est pertinent
* Utiliser des status codes HTTP adaptés au résultat de l'opération
* `201` pour une création réussie lorsque la ressource est créée
* `204` lorsqu'une opération réussit sans contenu à retourner
* Utiliser `400`, `404`, `409`, etc. lorsque le contexte le justifie
* Laisser FastAPI gérer les erreurs de validation des paramètres et schemas

```python
@router.post(
    "/recipes",
    response_model=RecipeOut,
    status_code=201,
)
async def create_recipe(
    data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
):
    return await recipe_service.create(data, db)
```

---

## Pydantic v2

* Utiliser les APIs Pydantic v2
* Utiliser `ConfigDict(from_attributes=True)` pour les schemas construits depuis des objets ORM
* Utiliser `model_dump()` au lieu de `.dict()`
* Utiliser `model_validate()` au lieu de `.from_orm()`
* Utiliser `@field_validator` au lieu de `@validator`
* Séparer les schemas : `Base` → `Create` / `Update` → `Out`
* Éviter les schemas fourre-tout

```python
from pydantic import BaseModel, ConfigDict


class RecipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
```

---

## SQLAlchemy 2.x async

* Utiliser la syntaxe SQLAlchemy 2.x
* Utiliser `Mapped[type]` et `mapped_column()`
* Utiliser `AsyncSession` pour les opérations DB async
* Utiliser `select()` plutôt que les anciennes APIs Query
* Utiliser `await db.flush()` lorsqu'un ID généré par la DB est nécessaire avant le commit
* Respecter la convention du projet : pas de `db.commit()` dans les services
* Choisir explicitement les stratégies de chargement des relations
* Utiliser `selectinload()` ou `joinedload()` selon le cas afin d'éviter les requêtes N+1
* Ne pas charger les relations inutilement
* Les requêtes complexes peuvent être isolées dans des fonctions helper ou repositories lorsque cela améliore la lisibilité

```python
result = await db.execute(
    select(Recipe).options(
        selectinload(Recipe.ingredients)
    )
)

recipes = result.scalars().all()
```

---

## Gestion d'erreurs

* Utiliser `HTTPException` pour les erreurs HTTP attendues
* Utiliser des status codes adaptés au contexte
* Utiliser des messages d'erreur clairs mais sans exposer d'informations sensibles
* Les `try/except` doivent être ciblés
* Ne jamais faire `except Exception: pass`
* Logger les erreurs inattendues avec `logging`
* Ne jamais logger de secrets, tokens ou mots de passe
* Les erreurs de validation Pydantic sont gérées automatiquement par FastAPI

```python
try:
    result = await extract_from_url(url)
except ValueError as exc:
    raise HTTPException(
        status_code=422,
        detail=str(exc),
    ) from exc
```

---

## Nommage & style

* `snake_case` pour les variables, fonctions, modules et colonnes SQL
* `PascalCase` pour les classes
* `UPPER_CASE` pour les constantes
* Docstrings sur les fonctions et classes publiques lorsque cela améliore la compréhension
* Pas de `print()` pour le logging applicatif
* Utiliser `logging`

---

## Migrations Alembic

* Toute modification du schéma DB doit passer par Alembic
* Ne jamais modifier directement le schéma DB pour contourner une migration
* Utiliser `alembic revision --autogenerate` lorsque pertinent
* Toujours relire et corriger manuellement une migration générée automatiquement
* Ne jamais considérer une migration autogénérée comme correcte sans vérification
* Les migrations doivent être suffisamment explicites pour comprendre leur impact sur les données existantes

---

## Tests

* N'écris pas de tests sauf si la tâche le demande explicitement
* Ne crée pas de fichier de test sans demande explicite
* Ne modifie pas les tests existants sauf s'ils sont directement liés à la tâche
* Lorsque des tests sont demandés, tester prioritairement le comportement directement concerné par la modification

---

## Anti-patterns à éviter

* ❌ I/O bloquante directement dans un endpoint `async def`
* ❌ `time.sleep()` dans du code async
* ❌ `db.commit()` dans les services — selon la convention transactionnelle du projet
* ❌ Logique métier importante dans les endpoints
* ❌ Requêtes SQLAlchemy susceptibles de créer un N+1
* ❌ Chargement inutile de relations
* ❌ Secrets hardcodés
* ❌ Mots de passe stockés en clair
* ❌ `Any` sans justification
* ❌ `print()` pour le logging applicatif
* ❌ `except Exception: pass`
* ❌ Modification directe du schéma DB sans migration Alembic
* ❌ Utilisation de l'API Anthropic sans demande explicite
