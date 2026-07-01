# Backend API — On-Demand Services Marketplace

NestJS REST API for the Service Platform. Handles authentication, business logic, database access, file storage orchestration, real-time broadcasts, and chatbot integration.

**Quick setup:** see [QuickStart.md](./QuickStart.md)

**Full project documentation:** [../docs/TECHNICAL_DOCUMENTATION.md](../docs/TECHNICAL_DOCUMENTATION.md)

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 6 |
| Auth | Supabase Auth + JWT (Passport) |
| Real-time | Supabase Realtime (broadcast) |
| Cache | Redis (ioredis) |
| Email | Resend |

---

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **npm** 9+
- A **Supabase** project (PostgreSQL + Auth + Storage + Realtime)
- **Redis** (local Docker or hosted) — required for chatbot sessions and caching

---

## Environment

Copy the template and fill in your values:

```bash
cp .env.example .env
```

Required variables: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`, `PORT`, `JWT_SECRET`, `REDIS_URL`.

See `.env.example` for the full list including optional chatbot settings.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run start:dev` | Start dev server with hot reload (`http://localhost:3000/api`) |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run production build |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npx prisma studio` | Open database GUI (`http://localhost:5555`) |
| `npm run db:seed:faq` | Seed FAQ entries |
| `npm run db:seed:providers` | Seed sample providers |

---

## API

- **Base URL:** `http://localhost:3000/api`
- **Auth:** `Authorization: Bearer <supabase_jwt>`
- **CORS:** enabled for `localhost:3000`, `localhost:19000`, `localhost:5173`

### Main modules

| Module | Path prefix | Description |
|--------|-------------|-------------|
| Auth | `/auth` | Registration completion, current user |
| Clients | `/clients` | Client profile, home feed |
| Providers | `/providers` | Provider profile, dashboard, services |
| Companies | `/companies`, `/company/*` | Company admin operations |
| Appointments | `/appointments` | Booking lifecycle |
| Messaging | `/messaging` | Conversations, messages, read receipts |
| Reviews | `/reviews` | Ratings and replies |
| Complaints | `/complaints` | Client complaints |
| Search | `/search` | Service discovery |
| Notifications | `/notifications` | In-app notifications |
| Chatbot | `/chatbot` | AI-assisted search (proxies Python service) |
| Admin | `/admin/*` | Platform administration |

---

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma       # Data models
│   └── migrations/         # SQL migrations
├── src/
│   ├── modules/            # Feature modules
│   ├── config/             # Prisma, Redis, Supabase
│   └── common/             # Guards, decorators, middleware
├── sql/                    # Manual SQL (chatbot embeddings, etc.)
├── supabase/               # Storage bucket policy scripts
├── .env.example
├── QuickStart.md
└── package.json
```

---

## User roles

| Role | Description |
|------|-------------|
| `CLIENT` | Books services, chats, reviews |
| `PROVIDER` | Offers services, manages schedule |
| `COMPANY_ADMIN` | Manages company employees and orders |
| `PLATFORM_ADMIN` | Full platform administration |

---

## Supabase storage buckets

Create these buckets in the Supabase dashboard and run the matching policy SQL files:

| Bucket | Purpose | Policies SQL |
|--------|---------|--------------|
| `avatars` | Client profile photos | `mobile-front/supabase/storage-policies-avatars.sql` |
| `provider-documents` | Verification documents | Dashboard / project docs |
| `service_photos` | Catalog images | `backend/supabase/storage-service-photos-policies.sql` |
| `gallery` | Provider service gallery | Dashboard |
| `chat-attachments` | Chat message images | `backend/supabase/storage-chat-attachments-policies.sql` |
| `appointment-request-photos` | Client booking photos | `backend/supabase/storage-appointment-request-photos-policies.sql` |
| `appointment-intervention-photos` | Before/after intervention | `backend/supabase/storage-appointment-intervention-photos-policies.sql` |
| `complaints_photos` | Complaint evidence | `backend/supabase/storage-complaints-photos-policies.sql` |

---

## Related apps

| App | Folder | Port |
|-----|--------|------|
| Mobile | `../mobile-front/` | Expo (19000) |
| Web admin | `../web-front/` | 5173 |
| Chatbot | `../chatbot/` | 8000 |

The backend must be running before starting the mobile or web clients.
