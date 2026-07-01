# Backend — Quick Start

Get the API running in a few minutes.

---

## 1. Prerequisites

```bash
node --version   # 18+
npm --version
```

Install [Node.js LTS](https://nodejs.org/) if missing.

Start **Redis** (required):

```bash
docker run -d --name serveme-redis -p 6379:6379 redis:7-alpine
```

---

## 2. Install

From the monorepo root:

```bash
cd backend
npm install
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@[HOST]:5432/postgres"

SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

PORT=3000
NODE_ENV=development

JWT_SECRET=          # same value as SUPABASE_JWT_SECRET
JWT_EXPIRATION=7d

REDIS_URL=redis://localhost:6379
```

Ask the project owner for these values if you do not have a Supabase project yet.

---

## 4. Database setup

```bash
npx prisma generate
npx prisma migrate deploy
```

Optional seeds:

```bash
npm run db:seed:faq
npm run db:seed:providers
```

---

## 5. Start the server

```bash
npm run start:dev
```

Expected output:

```
Server is running on: http://localhost:3000/api
LAN access: use your machine IP on port 3000 (mobile / Expo Go)
```

Verify in a browser: `http://localhost:3000/api`

---

## 6. Verify

| Check | How |
|-------|-----|
| API is up | Open `http://localhost:3000/api` |
| Database | `npx prisma studio` → `http://localhost:5555` |
| Mobile can connect | Start `mobile-front` on same Wi‑Fi; backend listens on `0.0.0.0` |

---

## Common commands

```bash
npm run start:dev      # Development (watch mode)
npm run build          # Production build
npm run start:prod     # Run production build
npx prisma studio      # Database browser
npx prisma generate    # After schema.prisma changes
npx prisma migrate deploy
```

---

## Troubleshooting

### Cannot connect to database

- Check `DATABASE_URL` and `DIRECT_URL` in `.env`
- Ensure the Supabase project is not paused
- Test network access to the Supabase host

### `EPERM` on `npx prisma generate`

Stop the running dev server (`Ctrl+C`), then run `npx prisma generate` again.

### Port 3000 already in use

**Windows:**

```powershell
netstat -ano | findstr :3000
```

Kill the process or set `PORT=3001` in `.env`.

### 401 Unauthorized on API calls

- Token expired — log in again in the client app
- Header must be `Authorization: Bearer <token>`
- `SUPABASE_JWT_SECRET` must match the Supabase project

### Redis connection errors

- Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
- Set `REDIS_URL=redis://localhost:6379` in `.env`
- Restart the backend

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows PowerShell, delete `node_modules` manually then run `npm install`.

---

## Next steps

1. Start the **mobile app**: `../mobile-front/QuickStart.md`
2. Start the **web admin**: `../web-front/QuickStart.md`
3. Optional **chatbot**: `../chatbot/README.md`
