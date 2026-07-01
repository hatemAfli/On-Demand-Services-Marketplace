# Web App — On-Demand Services Marketplace

React + Vite web application for **platform administrators** and **company administrators**. Manages users, validations, service catalog, appointments, complaints, reviews, FAQ, support messages, and company operations.

**Quick setup:** see [QuickStart.md](./QuickStart.md)

**Full project documentation:** [../docs/TECHNICAL_DOCUMENTATION.md](../docs/TECHNICAL_DOCUMENTATION.md)

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Framework | React 19, Vite 8 |
| Language | TypeScript |
| UI | Ant Design 6 |
| Routing | React Router 7 |
| HTTP | Axios |
| State | Zustand |
| Auth | Supabase Auth (JWT) |

---

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Backend API** running (`../backend/` on port 3000)
- A **PLATFORM_ADMIN** or **COMPANY_ADMIN** account

---

## Environment

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | Backend API base URL (default `http://localhost:3000/api`) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server (`http://localhost:5173`) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

---

## Applications & routes

### Platform admin (`PLATFORM_ADMIN`)

Login → `/admin/dashboard`

| Area | Route |
|------|-------|
| Dashboard | `/admin/dashboard` |
| Users | `/admin/users/*` |
| Companies | `/admin/companies` |
| Validations | `/admin/validations/*` |
| Catalog | `/admin/catalog/categories`, `/admin/catalog/services` |
| Appointments | `/admin/appointments/list` |
| Complaints | `/admin/reclamations` |
| Reviews | `/admin/reviews` |
| Support messages | `/admin/messages` |
| Chatbot sessions | `/admin/chatbot` |
| FAQ & legal | `/admin/content/faq`, `/admin/content/legal-documents` |
| Activity logs | `/admin/activity-logs` |

### Company admin (`COMPANY_ADMIN`)

Login → `/company/dashboard`

| Area | Route |
|------|-------|
| Dashboard | `/company/dashboard` |
| Providers | `/company/providers` |
| Services | `/company/services` |
| Orders | `/company/orders` |
| Schedule | `/company/schedule-capacity` |
| Complaints | `/company/complaints` |
| Ratings | `/company/ratings` |
| Settings | `/company/settings` |

Other roles are redirected to login or an access-blocked page.

---

## Project structure

```
web-front/
├── src/
│   ├── features/
│   │   ├── admin/           # Platform admin pages & layout
│   │   └── company_admin/   # Company admin pages & layout
│   ├── services/            # API clients (api.ts, adminApi, companyApi)
│   ├── stores/              # Auth store (Zustand)
│   ├── hooks/               # Auth bootstrap, admin counts
│   ├── components/          # Shared admin UI
│   └── types/               # TypeScript types
├── .env.example
├── QuickStart.md
└── package.json
```

---

## Related apps

| App | Folder | Must run first? |
|-----|--------|-----------------|
| Backend API | `../backend/` | **Yes** |
| Mobile | `../mobile-front/` | No (clients/providers use mobile) |
