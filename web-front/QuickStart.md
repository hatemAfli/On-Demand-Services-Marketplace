# Web App — Quick Start

Run the platform admin and company admin dashboards locally.

---

## 1. Prerequisites

```bash
node --version   # 18+
npm --version
```

- **Backend** must be running → [../backend/QuickStart.md](../backend/QuickStart.md)
- Admin account credentials (ask the project owner)

---

## 2. Install

```bash
cd web-front
npm install
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
VITE_API_URL=http://localhost:3000/api
```

---

## 4. Start the dev server

```bash
npm run dev
```

Open in browser: **http://localhost:5173**

---

## 5. Log in

| Role | After login |
|------|-------------|
| `PLATFORM_ADMIN` | Redirected to `/admin/dashboard` |
| `COMPANY_ADMIN` | Redirected to `/company/dashboard` |
| Other roles | Login page or access blocked |

Use credentials provided by the project owner. Platform admins can approve pending providers and companies under **Validations**.

---

## 6. Verify

| Check | Expected |
|-------|----------|
| Login page loads | `http://localhost:5173/login` |
| Admin dashboard | Stats and navigation after platform admin login |
| API calls work | No 401 errors in browser dev tools (Network tab) |
| User list | `/admin/users/all` shows registered users |

---

## Production build (optional)

```bash
npm run build
npm run preview
```

Preview URL is shown in the terminal (typically `http://localhost:4173`).

---

## Troubleshooting

### Blank page or auth errors

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after `.env` changes (`Ctrl+C`, then `npm run dev`)

### API requests fail (401 / network)

- Backend running at `http://localhost:3000/api`
- `VITE_API_URL` matches backend URL
- Log out and log in again if the token expired

### "Access blocked" after login

- Account status is not `ACTIVE` (e.g. `PENDING`, `SUSPENDED`)
- Wrong role for web app (only `PLATFORM_ADMIN` and `COMPANY_ADMIN`)

### CORS errors

- Backend `main.ts` allows `http://localhost:5173` by default
- If using a custom port, add it to backend CORS origins

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Quick demo checklist

- [ ] Log in as platform admin
- [ ] Open pending provider validations → approve one
- [ ] Browse service catalog categories and services
- [ ] View appointments list
- [ ] Log in as company admin (separate account)
- [ ] Open company dashboard and providers list

---

## Next steps

- **Mobile app:** [../mobile-front/QuickStart.md](../mobile-front/QuickStart.md)
- **Full documentation:** [../docs/TECHNICAL_DOCUMENTATION.md](../docs/TECHNICAL_DOCUMENTATION.md)
