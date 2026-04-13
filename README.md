# 🍽️ Mise en Bouche

Application web personnelle pour centraliser ses recettes importées depuis Instagram et TikTok.

---

## Prérequis

Installe ces outils avant de commencer :

- [Python 3.12+](https://python.org) — en cochant "Add to PATH"
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — pour PostgreSQL
- [Ollama](https://ollama.com/download) — puis lance :

```bash
ollama pull mistral
```

---

## Installation (première fois)

### 1. Clone le repo

```bash
git clone <url-du-repo>
cd recipe-app
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
cd ..
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
cd ..
```

---

## Démarrage

Lance chaque commande dans un terminal séparé :

**Terminal 1 — Base de données**
```bash
cd backend
docker-compose up -d
```

**Terminal 2 — Backend**
```bash
# Windows
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

# Mac / Linux
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 3 — Ollama**
```bash
ollama run mistral
```

**Terminal 4 — Frontend**
```bash
cd frontend
npm run dev
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