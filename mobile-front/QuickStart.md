# Mobile App — Quick Start

Run the Expo app and connect it to the backend API.

---

## 1. Prerequisites

```bash
node --version   # 18+
npm --version
```

- **Backend** must be running → [../backend/QuickStart.md](../backend/QuickStart.md)
- Install **Expo Go** on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)), or use an emulator

---

## 2. Install

```bash
cd mobile-front
npm install
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Minimum required in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]

EXPO_PUBLIC_APP_NAME="Service Platform"
EXPO_PUBLIC_APP_VERSION="1.0.0"
```

Optional — force API URL (use your PC's LAN IP on a physical device):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

Optional — maps on provider screens:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=[YOUR_KEY]
```

---

## 4. Start Expo

```bash
npx expo start
```

Or with a clean cache:

```bash
npx expo start --clear
```

### Open the app

| Target | Action |
|--------|--------|
| **Physical phone** | Scan QR code with Expo Go (same Wi‑Fi as PC) |
| **Android emulator** | Press `a` in the terminal |
| **iOS simulator** (macOS) | Press `i` in the terminal |

---

## 5. Verify

1. App opens without Supabase config errors in the console
2. Dev log shows: `[API] Using backend base URL: http://...`
3. Sign up or log in with a test account
4. Client home screen loads after login

---

## Physical device — API connection

The phone must reach your PC on port **3000**.

1. Find your PC LAN IP:
   - **Windows:** `ipconfig` → IPv4 address (e.g. `192.168.1.10`)
   - **macOS/Linux:** `ifconfig` or `ip addr`
2. Ensure backend is running: `http://<IP>:3000/api`
3. If auto-detection fails, set in `.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
   ```
4. Restart Expo: `npx expo start --clear`
5. Allow port 3000 through Windows Firewall if needed

---

## Emulator notes

| Platform | API URL (automatic) |
|----------|---------------------|
| Android emulator | `http://10.0.2.2:3000/api` |
| iOS simulator | `http://localhost:3000/api` |

---

## Troubleshooting

### "Supabase configuration is missing"

- Check `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
- Restart Expo after changing `.env`

### Network / API errors on phone

- PC and phone on the **same Wi‑Fi**
- Backend running with `npm run start:dev` in `backend/`
- Set `EXPO_PUBLIC_API_URL` to `http://<PC_IP>:3000/api`
- Disable VPN on phone or PC

### Expo cache issues

```bash
npx expo start --clear
```

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Test flows

| Flow | Role |
|------|------|
| Sign up → complete profile → home | CLIENT |
| Search service → book appointment | CLIENT |
| Open chat from appointment | CLIENT / PROVIDER |
| Accept appointment → update status | PROVIDER |
| AI service search | CLIENT (requires chatbot + Redis) |

---

## Next steps

- **Web admin:** [../web-front/QuickStart.md](../web-front/QuickStart.md)
- **Full documentation:** [../docs/TECHNICAL_DOCUMENTATION.md](../docs/TECHNICAL_DOCUMENTATION.md)
