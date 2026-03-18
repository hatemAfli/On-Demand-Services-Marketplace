# Quick Start Guide - Service Platform Backend

## 📋 Prerequisites

Before starting, ensure you have:

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm
npm --version

# Check git
git --version
```

If missing, install:

- Node.js: https://nodejs.org/ (LTS version)
- Git: https://git-scm.com/

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Clone Repository

```bash
git clone [repository-url]
cd service-platform-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including NestJS, Prisma, and authentication libraries.

### Step 3: Configure Environment

Create `.env` file in the project root:

```bash
cp .env.example .env
```

The file should contain:

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
SUPABASE_URL="https://..."
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_JWT_SECRET="..."

# Application
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET="The_same_as_SUPABASE_JWT_SECRET"
JWT_EXPIRATION=7d
```

### Step 4: Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma db push
```

### Step 5: Start Application

```bash
npm run start:dev
```

**Expected output:**

```
✅ Database connected successfully
🚀 Server is running on: http://localhost:3000/api
```

---

## ✅ Verify Installation

### Test 1: Check Server

Open browser: `http://localhost:3000`

### Test 2: View Database

```bash
npx prisma studio
```

Opens browser at `http://localhost:5555` - you can browse database tables.

---

---

## 🔧 Common Commands

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod

# View database (Prisma Studio)
npx prisma studio

# Generate Prisma client (after schema changes)
npx prisma generate

# Apply schema changes to database
npx prisma db push

# View logs
# (just check terminal where npm run start:dev is running)
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**

1. Check `.env` has correct `DATABASE_URL`
2. Check internet connection
3. Verify Supabase project is not paused

---

### Issue: "Unauthorized" when calling API

**Solution:**

1. Token may be expired (expires after 1 hour)
2. Get fresh token by logging in again
3. Check token format: `Bearer [token]` not just `[token]`

---

### Issue: "Module not found"

**Solution:**

```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: Server won't start

**Solution:**

1. Check if port 3000 is already in use
2. Kill existing process:
   - Windows: `netstat -ano | findstr :3000`
   - Mac/Linux: `lsof -ti:3000 | xargs kill`
3. Or change PORT in `.env` to 3001

---

### External Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)

---

## 📈 Next Development Phases

### Immediate Next

- User profile update endpoints
- Provider/company validation by admin
- File upload (documents, photos)
