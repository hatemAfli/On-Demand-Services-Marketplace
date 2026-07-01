# Mobile App — On-Demand Services Marketplace

Expo (React Native) mobile application for **clients**, **providers**, and **mobile admin** flows. Primary end-user interface for browsing services, booking appointments, messaging, reviews, and provider job management.

**Quick setup:** see [QuickStart.md](./QuickStart.md)

**Full project documentation:** [../docs/TECHNICAL_DOCUMENTATION.md](../docs/TECHNICAL_DOCUMENTATION.md)

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 55, React Native 0.83 |
| Language | TypeScript |
| Navigation | React Navigation 7 |
| HTTP client | Axios |
| Auth | Supabase Auth (JWT) |
| Real-time | Supabase Realtime |
| Maps | react-native-maps |
| i18n | i18next (English / Arabic) |

---

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Backend API** running (`../backend/` on port 3000)
- **Expo Go** on a physical device, or Android Studio / Xcode emulator
- Same **Wi‑Fi network** as your PC when testing on a real phone

---

## Environment

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `EXPO_PUBLIC_API_URL` | No | Override API URL (auto-detected if unset) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | For maps | Provider itinerary / map screens |
| `EXPO_PUBLIC_APP_NAME` | No | Display name |
| `EXPO_PUBLIC_APP_VERSION` | No | Version label |

The API base URL is resolved automatically in `src/utils/resolveApiBaseUrl.ts`:

1. `EXPO_PUBLIC_API_URL` if set
2. Same LAN IP as the Metro bundler (Expo Go on phone)
3. Android emulator → `10.0.2.2:3000`
4. iOS simulator / default → `localhost:3000`

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm start` | Start Expo dev server |
| `npx expo start --clear` | Start with cleared cache |
| `npm run android` | Open on Android emulator |
| `npm run ios` | Open on iOS simulator |

---

## User roles in the app

| Role | Main screens |
|------|--------------|
| **CLIENT** | Home, search, service details, appointments, chat, reviews, chatbot |
| **PROVIDER** | Dashboard, schedule, appointments, services, messaging, settings |
| **PLATFORM_ADMIN** | Users, validations, complaints (mobile admin subset) |
| **COMPANY_ADMIN** | Company dashboard (limited mobile; full UI on web) |

---

## Project structure

```
mobile-front/
├── src/
│   ├── screens/          # UI by role (client/, provider/, admin/, shared/)
│   ├── navigation/       # Stack and tab navigators
│   ├── services/         # API client (api.ts), Supabase, uploads
│   ├── hooks/            # Realtime, auth helpers
│   ├── components/       # Reusable UI
│   ├── context/          # Auth context
│   ├── i18n/             # Translations (en, ar)
│   └── utils/            # API URL resolution, helpers
├── assets/               # Icons, splash
├── app.json              # Expo config
├── .env.example
└── QuickStart.md
```

---

## Related apps

| App | Folder | Must run first? |
|-----|--------|-----------------|
| Backend API | `../backend/` | **Yes** |
| Web admin | `../web-front/` | No (separate login) |
| Chatbot | `../chatbot/` | Only for AI search feature |
