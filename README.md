# 🍽️ Mise en Bouche

Application web personnelle pour centraliser ses recettes importées depuis Instagram et TikTok.

---

## Prérequis

Avant de commencer, installe ces deux outils :

**1. Docker Desktop**
Télécharge et installe [Docker Desktop](https://www.docker.com/products/docker-desktop/) puis lance-le.

**2. Ollama + Mistral**
Télécharge et installe [Ollama](https://ollama.com/download), puis télécharge le modèle Mistral :

```bash
ollama pull mistral
```

---

## Démarrage

### Première fois

```bash
docker-compose up --build
```

### Les fois suivantes

```bash
# Terminal 1 — Lance Ollama
ollama run mistral

# Terminal 2 — Lance l'app
docker-compose up
```

### Arrêter

```bash
docker-compose down
```

### Arrêter et supprimer les données

```bash
docker-compose down -v
```

---

## URLs utiles

| Service | URL |
|---------|-----|
| App     | [http://localhost:5173](http://localhost:5173) |
| API     | [http://localhost:8000](http://localhost:8000) |
| Swagger | [http://localhost:8000/docs](http://localhost:8000/docs) |

---

## Structure

```
recipe-app/
├── backend/        # FastAPI + PostgreSQL + Ollama
├── frontend/       # React + TypeScript + Vite
└── README.md
```

Consulte les README de chaque dossier pour plus de détails :
- [backend/README.md](./backend/README.md)
- [frontend/README.md](./frontend/README.md)