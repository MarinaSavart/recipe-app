# 🍽️ Mise en Bouche — Backend

API REST construite avec **FastAPI** + **PostgreSQL** + **OpenRouter** pour extraire et structurer des recettes depuis des vidéos Instagram et TikTok.

---

## Stack

- **FastAPI** — framework web async
- **PostgreSQL** — base de données
- **SQLAlchemy 2.0** — ORM async
- **yt-dlp** — extraction de métadonnées Instagram / TikTok
- **OpenRouter** (Nemotron 3 Super) — parsing de la description en JSON structuré
- **Docker** — pour lancer PostgreSQL

---

## Prérequis

- Python 3.12+
- Docker Desktop (lancé)
- Une clé API OpenRouter — à créer sur [openrouter.ai/keys](https://openrouter.ai/keys)

---

## Installation

### 1. Clone le repo et place-toi dans le dossier backend

```bash
cd backend
```

### 2. Crée et active l'environnement virtuel

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python -m venv venv
source venv/bin/activate
```

### 3. Installe les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configure les variables d'environnement

```bash
cp .env.example .env
```

Édite `.env` :

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/recipes
OPENROUTER_API_KEY=       # obligatoire, pour le parsing des recettes
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
ANTHROPIC_API_KEY=        # optionnel, uniquement si tu utilises l'API Claude
```

### 5. Lance PostgreSQL avec Docker

```bash
docker-compose up -d
```

### 6. Lance le serveur

```bash
uvicorn app.main:app --reload
```

L'API est disponible sur [http://localhost:8000](http://localhost:8000)
La doc Swagger est disponible sur [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/recipes/` | Liste toutes les recettes |
| `GET` | `/recipes/{id}` | Détail d'une recette |
| `POST` | `/recipes/import` | Import depuis une URL Instagram/TikTok |
| `POST` | `/recipes/import/manual` | Import depuis une description collée |
| `PATCH` | `/recipes/{id}` | Mise à jour d'une recette |
| `POST` | `/recipes/{id}/photo` | Upload d'une photo |
| `DELETE` | `/recipes/{id}` | Suppression d'une recette |

---

## Structure
```
backend/
├── app/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── config.py            # Variables d'environnement
│   ├── database.py          # Connexion PostgreSQL async
│   ├── models/
│   │   └── recipe.py        # Modèles SQLAlchemy
│   ├── schemas/
│   │   └── recipe.py        # Schemas Pydantic
│   ├── services/
│   │   ├── extractor.py     # Extraction yt-dlp
│   │   └── claude.py        # Parsing OpenRouter
│   └── routers/
│       └── recipes.py       # Endpoints
├── uploads/                 # Photos uploadées
├── .env.example
├── docker-compose.yml
└── requirements.txt
```
---

## Notes

- Les tables SQL sont créées automatiquement au démarrage en développement
- Les photos sont servies statiquement sur `/uploads/{filename}`
- L'extraction Instagram nécessite d'être connecté dans un navigateur (Chrome, Firefox, Edge...)
- En cas d'échec de l'extraction automatique, utilise l'import manuel