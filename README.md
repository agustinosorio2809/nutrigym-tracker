# NutriGym Tracker

A full-stack progressive web app for tracking nutrition and gym routines, with Android APK support.

🌐 **Live app:** [nutrigym-tracker.vercel.app](https://nutrigym-tracker.vercel.app)

---

## Features

- **Nutrition tracking** — log daily meals against a structured weekly plan
- **AI meal planning** — generate a personalized weekly meal plan with Gemini 2.5 Flash Lite
- **Viandas inventory** — track your prepared meal containers (viandas) and portion counts
- **Gym routines** — structured workout sessions organized by muscle group with weight/reps history
- **Estimated 1RM & PR detection** — per-exercise one-rep-max estimate (Epley) and automatic personal-record detection from set history
- **Automatic weight progression** — smart load suggestion via double-progression (RIR feedback), plateau detection, and deload offers
- **Local notifications** — configurable meal-time reminders (Android)
- **Body recomposition focus** — nutrition and training designed around fat loss + muscle maintenance
- **Dark mode UI** — clean interface with bottom navigation
- **Android APK** — installable as a native app on Android devices
- **PWA support** — installable from the browser on any device

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend / DB | Supabase (PostgreSQL + RLS + Auth) |
| Hosting | Vercel |
| Mobile | Capacitor (Android APK) |
| AI | Google Gemini 2.5 Flash Lite |
| Charts | Recharts |
| Excel import | ExcelJS |
| Tests | Vitest |
| CI/CD | GitHub Actions |

---

## Architecture

```
nutrigym-tracker/
├── api/
│   └── gemini.js         # Vercel serverless proxy — keeps Gemini API key server-side
├── src/
│   ├── pages/            # Dashboard, PlanSemanal, Viandas, Gimnasio, Perfil
│   ├── services/         # Pure logic + external APIs — no JSX, no hooks
│   │   ├── geminiPlan.js       # Weekly plan generation via /api/gemini
│   │   ├── notifications.js    # Local notification scheduling (Capacitor)
│   │   ├── oneRepMax.js        # Epley 1RM, best set, PR detection, exercise-name identity
│   │   └── progresion.js       # Load suggestion (RIR double progression), plateau, deload
│   ├── components/       # icons.jsx (shared SVG icon set), gym.jsx (Gimnasio presentation)
│   ├── hooks/            # useInteractiveStyle.js (hover/focus/active — no CSS files)
│   ├── theme.js          # Design tokens (colors, spacing)
│   ├── App.jsx           # Auth, routing, nav
│   └── supabase.js       # Supabase client (singleton)
├── docs/superpowers/
│   ├── specs/            # Design docs, one per feature spec
│   └── roadmaps/         # Completed implementation roadmaps
├── supabase/migrations/  # SQL schema + RLS policies
├── android/              # Capacitor Android project
└── .github/workflows/    # GitHub Actions (APK build)
```

Business logic lives in `src/services/` as pure functions with no Supabase or React
dependency, so it can be tested without mocks. Pages do the I/O and hand already-loaded
data to those functions.

**Repo conventions:** `CLAUDE.md` (architecture and stack), `CODESTYLE.md` (how code is
written), `DECISIONS.md` (ambiguities resolved during implementation, with the why),
`ROADMAP.md` (the feature currently being built), `design.md` (the design system).

---

## Design system

Rediseño anti-slop completo (2026-08-25). `design.md` en la raíz documenta el sistema
de diseño (paleta, tipografía, iconografía, tratamiento de contenedores, estados
hover/focus/active). Tokens de color compartidos en `src/theme.js`, set único de
íconos SVG en `src/components/icons.jsx`, interactividad (hover/focus/active) vía
`src/hooks/useInteractiveStyle.js` — necesario porque el proyecto es 100% estilos
inline, sin CSS externo.

---

## CI/CD Pipeline

On every push to `main`:

1. Vercel automatically deploys the web app
2. GitHub Actions builds the Android APK via Capacitor
3. APK is published as a release artifact

---

## Getting Started

### Prerequisites

- Node.js 22+
- A Supabase project

### Setup

```bash
git clone https://github.com/agustinosorio2809/nutrigym-tracker
cd nutrigym-tracker
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
```

> **Gemini API key:** `GEMINI_API_KEY` is server-side only — add it to Vercel Environment Variables (no `VITE_` prefix). Never put it in `.env`; the app routes all Gemini calls through `api/gemini.js`.

```bash
npm run dev
```

### Tests

```bash
npm test          # run once
npm run test:watch
```

Vitest covers the pure logic in `src/services/`. React components and Supabase queries
are deliberately not tested — see `CODESTYLE.md § Testing` for the reasoning.

### Android APK

```bash
npm run build
npx cap sync android
npx cap open android
```

Or download the latest APK from [Releases](https://github.com/agustinosorio2809/nutrigym-tracker/releases).

---

## Database

Hosted on Supabase with Row Level Security enabled on all tables (each user sees only their own data).

| Table | Description |
|---|---|
| `meal_plans` | Weekly plan header (one per week per user) |
| `planned_meals` | Individual meals per day/slot within a plan |
| `meal_logs` | Daily log entries tracking actual vs planned |
| `viandas` | Prepared meal container inventory with portion counts |
| `gym_logs` | Gym session records |
| `gym_exercises` | Exercises within a session |
| `gym_sets` | Individual sets per exercise (weight, reps, RIR) |
| `routine_templates` | Saved exercise templates per routine type |
| `user_profile` | Physical stats, training days, notification prefs |

---

## License

MIT
