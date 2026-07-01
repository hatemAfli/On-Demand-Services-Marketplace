# On-Demand Services Marketplace

A full-stack platform connecting clients with local service providers and companies. Built as an internship (PFE) project.

## Applications

| App             | Folder          | Description                                       |
| --------------- | --------------- | ------------------------------------------------- |
| **Backend API** | `backend/`      | NestJS REST API — business logic, auth, database  |
| **Mobile**      | `mobile-front/` | Expo app for clients, providers, and mobile admin |
| **Web**         | `web-front/`    | Platform admin & company admin dashboards         |
| **Chatbot**     | `chatbot/`      | Python AI microservice                            |

## Quick start

| App | README | Quick Start |
|-----|--------|-------------|
| **Backend API** | [backend/README.md](backend/README.md) | [backend/QuickStart.md](backend/QuickStart.md) |
| **Mobile** | [mobile-front/README.md](mobile-front/README.md) | [mobile-front/QuickStart.md](mobile-front/QuickStart.md) |
| **Web admin** | [web-front/README.md](web-front/README.md) | [web-front/QuickStart.md](web-front/QuickStart.md) |

**Order:** start the backend first, then mobile or web.

```bash
# Backend
cd backend && npm install && cp .env.example .env
npx prisma generate && npx prisma migrate deploy && npm run start:dev

# Mobile (new terminal)
cd mobile-front && npm install && cp .env.example .env && npx expo start

# Web (new terminal)
cd web-front && npm install && cp .env.example .env && npm run dev
```

## Documentation

**Full technical documentation and setup:**

→ **[docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md)**

Includes architecture, environment variables, API overview, troubleshooting, and demo checklist.
