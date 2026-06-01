# NutriGym Tracker

A full-stack progressive web app for tracking nutrition and gym routines, with Android APK support.

🌐 **Live app:** [nutrigym-tracker.vercel.app](https://nutrigym-tracker.vercel.app)

---

## Features

- **Nutrition tracking** — log daily meals and monitor caloric/macro intake
- **Gym routines** — structured workout plans organized by muscle group
  - Chest + Triceps + Core
  - Back + Biceps + Core
  - Shoulders + Back + Core + Legs
- **Body recomposition focus** — dual-protocol cardio system alongside strength training
- **Dark mode UI** — clean interface with bottom navigation
- **Android APK** — installable as a native app on Android devices
- **PWA support** — installable from the browser on any device

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend / DB | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Mobile | Capacitor (Android APK) |
| CI/CD | GitHub Actions |

---

## Architecture

```
nutrigym-tracker/
├── src/
│   ├── components/       # UI components (bottom nav, cards, forms)
│   ├── pages/            # Main views (nutrition, routines, progress)
│   └── lib/              # Supabase client and helpers
├── android/              # Capacitor Android project
├── .github/workflows/    # GitHub Actions (APK build + deploy)
└── vite.config.js
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

- Node.js 18+
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
VITE_SUPABASE_ANON_KEY=your_anon_key
```

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

Hosted on Supabase. Main tables:

- `profiles` — user data
- `meals` — nutrition log entries
- `routines` — workout templates
- `exercises` — exercise catalog per routine

---

## License

MIT
