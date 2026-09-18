# Mise en Bouche — Recipe App

## ⚠️ Comportement par défaut

* **Ne pas écrire de tests** sauf demande explicite
* **Ne pas ajouter de dépendances** sauf demande explicite
* **Ne pas reformater** les fichiers non touchés par la tâche
* **Ne pas commiter, pusher ou créer de branche** sans demande explicite

---

## Stack

### Backend

* Python 3.13 + FastAPI + SQLAlchemy 2.x (async) + PostgreSQL
* Ollama (Mistral) pour le parsing des recettes
* yt-dlp pour l'extraction des métadonnées Instagram/TikTok

### Frontend

* React 19 + TypeScript 6 + Vite 8
* React Compiler activé
* React Router v7
* Vitest + Testing Library pour les tests
* SCSS maison (BEM), pas de UI library

---

## Structure du projet

```text
recipe-app/

├── backend/
│   ├── app/
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic (extractor, parsing)
│   │   └── routers/     # FastAPI endpoints
│   └── uploads/         # Photos uploadées
│
└── frontend/
    └── src/
        ├── components/  # Composants réutilisables
        ├── pages/       # Pages / orchestrateurs
        ├── services/    # Appels API
        ├── types/       # Types TypeScript
        └── utils/       # Fonctions pures
```

---

## Commandes utiles

```bash
# Terminal 1 — DB
cd backend && docker-compose up -d

# Terminal 2 — Backend
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload

# Terminal 3 — Ollama
ollama run mistral

# Terminal 4 — Frontend
cd frontend && npm run dev
```

---

## Règles de contribution

### Architecture & responsabilités

* Respecte le découpage existant :

  * `pages/` orchestre
  * `components/` affiche
  * `services/` appelle l'API
  * `utils/` contient les fonctions pures
* Ne mets pas de logique métier dans les composants — elle va dans `utils/` ou `services/`
* Préserve la séparation backend / frontend : aucun accès direct à la DB depuis le frontend
* Toutes les opérations avec la DB passent par le backend
* Le frontend communique avec le backend via l'API REST
* Les noms de colonnes SQL utilisent `snake_case`
* Toute modification du schéma de base de données doit passer par une migration Alembic
* Ne modifie pas directement le schéma de la base de données pour contourner une migration

### Sécurité & données sensibles

* Ne journalise jamais de mot de passe, token JWT, cookie de session ou clé API
* Ne commite jamais `.env`, `cookies/` ou tout fichier contenant des secrets
* Les secrets doivent rester exclus du contrôle de version via `.gitignore`
* Ne contourne pas le hashage bcrypt pour les mots de passe utilisateur
* Les tokens JWT restent dans le `localStorage` côté client
* Ne jamais exposer les tokens ou secrets dans les logs, erreurs ou réponses API

### Style & formatage

* Frontend :

  * camelCase pour variables et fonctions
  * PascalCase pour composants et types
  * anglais pour tout le code
* Backend :

  * snake_case pour les variables, fonctions et modules Python
  * `async def` / `await` pour les opérations I/O asynchrones
* CSS :

  * BEM strict avec SCSS
  * pas de style inline sauf exception justifiée
* Prettier et ESLint sont configurés
* Ne lance pas de reformatage global sur des fichiers non concernés par la tâche
* Préserve les modifications locales existantes qui ne font pas partie de la demande

### React

* Functional components uniquement
* Pas de class components
* Pas d'import `React` nécessaire avec le nouveau JSX transform
* Pas de `React.FC` — typer les props directement
* React 19 : passer `ref` directement comme prop ; éviter `forwardRef` pour les nouveaux composants
* Ne pas utiliser `useEffect` pour dériver des valeurs à partir du state ou des props
* Ne pas utiliser `useEffect` pour réagir à une interaction utilisateur
* Préférer les event handlers pour les actions utilisateur
* Le React Compiler est activé dans le projet
* Ne pas ajouter `useMemo`, `useCallback` ou `React.memo` par réflexe
* Respecter les Rules of React afin de permettre au Compiler d'optimiser les composants

### TypeScript

* `strict: true`
* Jamais de `any` — utiliser `unknown` lorsqu'un type est réellement inconnu
* `interface` par défaut pour les objets et props de composants
* `type` pour les unions, intersections, alias et types utilitaires
* `import type` pour les imports de types uniquement
* Utiliser des discriminated unions pour les états async gérés localement
* Ne pas recréer un modèle d'état async lorsqu'une librairie utilisée par le projet en fournit déjà un

### Dépendances & outillage

* N'ajoute pas de nouvelle dépendance npm ou pip sans que la tâche le justifie explicitement
* Si une nouvelle dépendance est nécessaire, l'ajouter dans `requirements.txt` ou le fichier de dépendances Python approprié pour le backend, ou dans `package.json` pour le frontend
* Ne modifie pas `docker-compose.yml`, `vite.config.ts` ou les fichiers de configuration sans raison explicite
* Ne remplace pas une dépendance existante par une autre sans demande ou justification technique claire

### Tests

* N'écris pas de tests sauf si la tâche le demande explicitement
* Frontend : Vitest + Testing Library
* Lorsque des tests sont demandés, cibler les comportements directement liés à la tâche
* Les fonctions pures de `utils/` sont prioritaires pour les tests unitaires
* Les composants React peuvent être testés avec Testing Library lorsque cela est pertinent
* Ne crée pas de fichiers `*.test.*` ou `*.spec.*` sans demande explicite
* Ne modifie pas les tests existants sauf s'ils sont directement liés à la tâche

### Git

* Ne commite pas, ne push pas et ne crée pas de branche sans que la tâche le demande explicitement
* Un changement = un scope limité : ne modifie pas les fichiers non concernés par la demande
* Les messages de commit suivent le format :

```text
type(scope): description
```

Exemples :

```text
feat(profile): add TDEE calculation
fix(auth): correct JWT expiry
refactor(recipes): split import service
```
