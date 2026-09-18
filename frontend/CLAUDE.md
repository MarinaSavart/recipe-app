# Frontend — React + TypeScript

## ⚠️ Comportement par défaut
- **Ne pas écrire de tests** sauf demande explicite
- **Ne pas ajouter de dépendances** npm sauf demande explicite
- **Ne pas reformater** les fichiers non touchés par la tâche

---

## Tooling

- Build tool : Vite 8
- Bundler : Rolldown
- Tests : Vitest
- TypeScript strict
- React Compiler activé

## Lancer

```bash
npm run dev
```

---

## Architecture

```
src/
├── components/
│   ├── GoalsSection.tsx     # Objectifs nutritionnels
│   ├── MacroBox.tsx         # Boîte macro (kcal, protéines...)
│   ├── MetricsSection.tsx   # Formulaire métriques personnelles
│   ├── Navbar.tsx           # Navigation latérale rétractable
│   ├── ProfileHeader.tsx    # Avatar + nom + email
│   └── RecipeCard.tsx       # Carte recette dans la grille
├── context/
│   └── AuthContext.tsx      # État auth global (user, token, login, logout)
├── pages/
│   ├── Login.tsx
│   ├── Profile.tsx          # Orchestrateur profil (métriques + objectifs)
│   ├── RecipeDetail.tsx     # Détail recette + sélecteur portions
│   ├── RecipeEdit.tsx       # Édition recette + upload photo
│   ├── RecipeImport.tsx     # Import URL ou description manuelle
│   ├── RecipeList.tsx       # Grille de recettes
│   └── Register.tsx
├── services/
│   └── api.ts               # Toutes les fonctions fetch (une seule source de vérité)
├── styles/
│   ├── _auth.scss
│   ├── _cards.scss
│   ├── _navbar.scss
│   ├── _pages.scss
│   ├── _profile.scss
│   ├── _reset.scss
│   ├── _variables.scss      # CSS custom properties + tokens SCSS
│   └── main.scss
├── types/
│   ├── profil.ts            # PersonalMetrics, NutritionalGoals, GOALS, WORK_ACTIVITIES
│   └── recipe.ts            # Recipe, RecipeListItem, Ingredient, Step, Tag
└── utils/
    └── nutritionCalc.ts     # calculateTDEE, calculateMacros, getActivityMultiplier
```

---

## Conventions

### Code
- Anglais pour tout : variables, fonctions, interfaces, commentaires
- camelCase pour variables/fonctions, PascalCase pour composants et types
- `const` par défaut, `let` seulement si réassigné
- Pas de `any` TypeScript
- Pas de `console.log` (warn/error OK)

### CSS
- BEM strict : `.profile__section-title`, `.recipe-card__body`
- SCSS uniquement — pas de CSS-in-JS, pas de Tailwind
- Pas de style inline sauf exception justifiée (layout dynamique)
- Les variables de couleur passent par les CSS custom properties (`var(--amber)`)

### Composants
- `pages/` = orchestrateurs : gèrent le state, les effets, les appels API
- `components/` = affichage pur : reçoivent des props, n'appellent pas l'API directement
- Pas de logique métier dans les composants — elle va dans `utils/`

---

## Variables d'environnement (.env)

```
VITE_API_URL=http://localhost:8000
```

---

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | RecipeList | Grille de toutes les recettes |
| `/recipes/:id` | RecipeDetail | Détail + sélecteur portions |
| `/recipes/:id/edit` | RecipeEdit | Édition + upload photo |
| `/import` | RecipeImport | Import URL ou manuel |
| `/profile` | Profile | Métriques + objectifs nutritionnels |
| `/login` | Login | Connexion |
| `/register` | Register | Inscription |

---

## localStorage

| Clé | Contenu |
|-----|---------|
| `token` | JWT d'authentification |
| `user` | Objet user sérialisé |
| `theme` | `'dark'` ou `'light'` |
| `personal_metrics` | `PersonalMetrics` sérialisé |
| `nutritional_goals` | `NutritionalGoals` sérialisé |

## Bonnes pratiques React 19 + TypeScript

### Composants

- Functional components uniquement — pas de class components
- Pas d'import `React` nécessaire avec le nouveau JSX transform
- Pas de `React.FC` — typer les props directement
- Named exports préférés pour les composants réutilisables
- React 19 : passer `ref` directement comme prop ; éviter `forwardRef` pour les nouveaux composants

### TypeScript

- `strict: true` obligatoire
- Jamais de `any` — utiliser `unknown` lorsque le type est réellement inconnu
- `interface` par défaut pour les objets et props de composants
- `type` pour les unions, intersections, alias, tuples et types utilitaires
- `import type` pour les imports de types uniquement
- Utiliser des discriminated unions pour les états async gérés localement
- Avec une librairie de data fetching, utiliser son modèle d'état plutôt que recréer un état async

### Hooks

- `useEffect` est un escape hatch pour synchroniser React avec des systèmes externes
- Ne pas utiliser `useEffect` pour dériver une valeur à partir du state ou des props
- Ne pas utiliser `useEffect` pour réagir à une interaction utilisateur
- Préférer les event handlers pour les actions utilisateur
- `useMemo` et `useCallback` uniquement lorsqu'ils apportent une valeur réelle ou un contrôle précis
- Le React Compiler gère automatiquement la majorité de la mémoïsation
- Custom hooks pour encapsuler un comportement réutilisable avec une responsabilité claire

### State management

- State local UI → `useState`
- State partagé entre quelques composants → props ou Context
- Ne pas créer de state global inutilement
- Co-localiser le state avec le composant qui le possède
- Éviter le prop drilling excessif ; utiliser Context lorsque plusieurs niveaux de composants doivent partager le même état

### Performance

- Le React Compiler est activé dans ce projet
- Ne pas ajouter `React.memo`, `useMemo` ou `useCallback` par réflexe
- Profiler avant d'ajouter une optimisation manuelle
- Utiliser des `key` stables sur les listes
- Ne jamais utiliser l'index comme `key` lorsqu'une liste peut être réordonnée, filtrée ou modifiée

### React Compiler

- Respecter strictement les Rules of React
- Ne pas utiliser `"use memo"` ou `"use no memo"` sans justification
- Si un composant ne peut pas être compilé, comprendre et corriger la cause lorsque possible
- Utiliser `"use no memo"` uniquement comme solution temporaire documentée

### Anti-patterns

- ❌ `useEffect` pour dériver du state
- ❌ `useEffect` pour réagir à un événement utilisateur
- ❌ State inutile pour des valeurs dérivables
- ❌ `any` TypeScript
- ❌ `console.log`
- ❌ Logique métier dans les composants
- ❌ Appels API directs dans les composants
- ❌ `useMemo` / `useCallback` / `React.memo` ajoutés sans justification