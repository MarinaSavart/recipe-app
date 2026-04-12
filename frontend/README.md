# 🍽️ Mise en Bouche — Frontend

Interface web construite avec **React** + **TypeScript** + **Vite** pour gérer sa banque de recettes personnelle.

---

## Stack

- **React 19** + **TypeScript**
- **Vite** — bundler
- **React Router v6** — navigation
- **SCSS** — styles maison
- **React Compiler** — optimisations automatiques

---

## Prérequis

- Node.js 18+
- Le backend lancé sur `http://localhost:8000`

---

## Installation

### 1. Place-toi dans le dossier frontend

```bash
cd frontend
```

### 2. Installe les dépendances

```bash
npm install
```

### 3. Configure les variables d'environnement

```bash
cp .env.example .env
```

Le `.env` par défaut pointe sur le backend local :

```env
VITE_API_URL=http://localhost:8000
```

### 4. Lance le serveur de développement

```bash
npm run dev
```

L'app est disponible sur [http://localhost:5173](http://localhost:5173)

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Liste de toutes les recettes |
| `/import` | Import depuis URL ou description manuelle |
| `/recipes/:id` | Détail d'une recette |
| `/recipes/:id/edit` | Édition d'une recette |

---

## Structure
```
frontend/
├── src/
│   ├── pages/
│   │   ├── RecipeList.tsx       # Page d'accueil — grille de recettes
│   │   ├── RecipeDetail.tsx     # Page détail avec sélecteur de portions
│   │   ├── RecipeImport.tsx     # Import URL / manuel
│   │   └── RecipeEdit.tsx       # Édition + upload photo
│   ├── components/
│   │   ├── Navbar.tsx           # Navigation latérale rétractable
│   │   ├── RecipeCard.tsx       # Carte recette
│   │   └── MacroBox.tsx         # Boîte macro (kcal, protéines...)
│   ├── services/
│   │   └── api.ts               # Toutes les fonctions fetch
│   ├── styles/
│   │   ├── _variables.scss      # Couleurs, typo, espacements
│   │   ├── _reset.scss          # Reset CSS
│   │   ├── _navbar.scss
│   │   ├── _cards.scss
│   │   ├── _pages.scss
│   │   └── main.scss
│   ├── types/
│   │   └── recipe.ts            # Interfaces TypeScript
│   └── main.tsx                 # Point d'entrée + routing
├── .env.example
└── vite.config.ts
```
---

## Fonctionnalités

- 📥 Import automatique depuis une URL Instagram ou TikTok
- ✍️ Import manuel en collant la description
- 🔢 Sélecteur de portions — adapte les quantités en temps réel
- ✏️ Édition complète d'une recette
- 📷 Upload de photo personnalisée
- ☀️🌙 Mode clair / sombre persisté
- 📱 Responsive mobile
- 🗂️ Navbar rétractable

---

## Démarrage rapide (backend + frontend)

```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate       # Windows
uvicorn app.main:app --reload

# Terminal 2 — Ollama
ollama run mistral

# Terminal 3 — Frontend
cd frontend
npm run dev
```