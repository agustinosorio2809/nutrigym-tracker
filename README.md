# NutriGym Tracker

A full-stack progressive web app for tracking nutrition and gym routines, with Android APK support.

🌐 **Live app:** [nutrigym-tracker.vercel.app](https://nutrigym-tracker.vercel.app)

---

## Features

- **Nutrition tracking** — log daily meals against a structured weekly plan
- **AI meal planning** — generate a personalized weekly meal plan with Gemini 2.5 Flash Lite
- **Viandas inventory** — track your prepared meal containers (viandas) and portion counts
- **Gym routines** — structured workout sessions organized by muscle group with weight/reps history
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
| Excel import | SheetJS (xlsx) |
| CI/CD | GitHub Actions |

---

## Architecture

```
nutrigym-tracker/
├── api/
│   └── gemini.js         # Vercel serverless proxy — keeps Gemini API key server-side
├── src/
│   ├── pages/            # Dashboard, PlanSemanal, Viandas, Gimnasio, Perfil
│   ├── services/         # geminiPlan.js, notifications.js
│   ├── App.jsx           # Auth, routing, nav
│   └── supabase.js       # Supabase client (singleton)
├── supabase/migrations/  # SQL schema + RLS policies
├── android/              # Capacitor Android project
└── .github/workflows/    # GitHub Actions (APK build)
```

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
| `routine_templates` | Saved exercise templates per routine type |
| `user_profile` | Physical stats, training days, notification prefs |

---

## License

MIT
