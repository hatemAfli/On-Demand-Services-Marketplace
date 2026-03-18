# Service Platform Backend - Authentication System

---

## 🏗️ Technology Stack

- **Backend Framework:** NestJS (Node.js)
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma
- **Authentication:** Supabase Auth + JWT (ES256)
- **Language:** TypeScript

---

## ✅ Completed Phase 1: Authentication Foundation

### - Backend Setup -

#### Supabase Configuration

- Created Supabase project with PostgreSQL database
- Configured email authentication provider
- Customized email templates (signup confirmation, password reset)
- Created test users for each role (CLIENT, PROVIDER, COMPANY_ADMIN, PLATFORM_ADMIN)

#### NestJS Authentication Module

- Installed dependencies: Prisma, JWT, Passport, Supabase client
- Configured database connection to Supabase PostgreSQL
- Created Prisma schema with User,Client, Provider, CompanyAdmin and PlatformAdmin models
- Implemented JWT authentication strategy with ES256 algorithm
- Created authentication guards (JwtAuthGuard, RolesGuard)
- Built role-based access control system
- Tested all endpoints successfully via Postman

---

## 🗄️ Database Schema

### User Roles

```
CLIENT           → Regular users seeking services
PROVIDER         → Service providers (independent or employees)
COMPANY_ADMIN    → Company administrators managing employees
PLATFORM_ADMIN   → Platform administrators
```

### Account Status

```
PENDING    → Awaiting admin validation (PROVIDER, COMPANY_ADMIN)
ACTIVE     → Account approved and active
REJECTED   → Account rejected by admin
SUSPENDED  → Temporarily suspended
DELETED    → Soft-deleted account
```

### Core Models

- **users** - Base user information (all roles)
- **clients** - client-specific data
- **providers** - Provider-specific data (documents, ratings)
- **company_admins** - Company admin information
- **platform_admins** - Platform admin information

---

## 🔐 Authentication Architecture

### Flow Overview

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
└────────┬────────┘
         │
         │ 1. Login/Register
         ↓
┌─────────────────┐
│  Supabase Auth  │ ← Handles authentication
└────────┬────────┘
         │
         │ 2. Returns JWT Token (ES256)
         ↓
┌─────────────────┐
│   React Native  │ ← Stores token securely
│  (Secure Store) │
└────────┬────────┘
         │
         │ 3. API Request + JWT Token
         ↓
┌─────────────────┐
│  NestJS Backend │ ← Verifies token & enforces roles
└────────┬────────┘
         │
         │ 4. Database Operations
         ↓
┌─────────────────┐
│   PostgreSQL    │
│   (Supabase)    │
└─────────────────┘
```

### Registration Process

1. **User Signs Up via Supabase Auth**
   - Frontend calls Supabase Auth directly
   - Supabase creates account and sends verification email
   - Returns JWT access token + refresh token

2. **Complete Profile Creation**
   - Frontend calls NestJS: `POST /api/auth/complete-registration`
   - Sends JWT token + profile data
   - NestJS verifies token and creates user profile in PostgreSQL
   - Sets account status (ACTIVE for clients, PENDING for providers/companies)

3. **Account Activation**
   - CLIENT: Immediately active
   - PROVIDER/COMPANY: Requires admin validation
   - Admin reviews documents and approves/rejects

---

## 🔧 Implemented Endpoints

### Authentication Endpoints

| Method | Endpoint                          | Auth Required | Role | Description                                 |
| ------ | --------------------------------- | ------------- | ---- | ------------------------------------------- |
| POST   | `/api/auth/complete-registration` | ✅ JWT        | Any  | Complete user profile after Supabase signup |
| GET    | `/api/auth/me`                    | ✅ JWT        | Any  | Get current user profile                    |

### User Management Endpoints

| Method | Endpoint         | Auth Required | Role           | Description    |
| ------ | ---------------- | ------------- | -------------- | -------------- |
| GET    | `/api/users`     | ✅ JWT        | PLATFORM_ADMIN | List all users |
| GET    | `/api/users/:id` | ✅ JWT        | PLATFORM_ADMIN | Get user by ID |

---

## 🧪 Testing Results

### Test Users Created

| Email                     | Password     | Role           | Status  |
| ------------------------- | ------------ | -------------- | ------- |
| testclient@example.com    | Test123456!  | CLIENT         | ACTIVE  |
| testprovider@example.com  | Test123456!  | PROVIDER       | PENDING |
| testcompany@example.com   | Test123456!  | COMPANY_ADMIN  | PENDING |
| admin@serviceplatform.com | Admin123456! | PLATFORM_ADMIN | ACTIVE  |

### Successful Test Cases ✅

1. ✅ User registration with CLIENT role (immediate activation)
2. ✅ User registration with PROVIDER role (pending validation)
3. ✅ JWT token verification with ES256 algorithm
4. ✅ Role-based access control (403 for unauthorized roles)
5. ✅ Protected routes reject unauthenticated requests (401)
6. ✅ Current user retrieval with full profile data
7. ✅ Admin-only endpoints protected correctly

---

## 📁 Project Structure

```
backend/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── config/
│   │   ├── prisma.config.ts       # Prisma ORM service
│   │   └── supabase.config.ts     # Supabase client
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts  # JWT authentication guard
│   │   │   └── roles.guard.ts     # Role-based access guard
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts # Role metadata decorator
│   │   │   └── current-user.decorator.ts
│   │   └── middleware/
│   │       └── logger.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts  # JWT verification strategy
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   └── users/
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── users.module.ts
│   ├── app.module.ts
│   └── main.ts
├── .env                           # Environment variables (not in git)
├── .env.example                   # Template for environment variables
└── package.json
```

---

## 🔑 Environment Variables

Required configuration in `.env`:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
SUPABASE_URL="https://[project-id].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_JWT_SECRET="your-jwt-secret"

# Application
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRATION=7d
```

---

## 🚀 Running the Application

### Prerequisites

```bash
node --version  # v18 or higher
npm --version
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### Development

```bash
# Start development server
npm run start:dev

# Server runs on http://localhost:3000
```

### Database Management

```bash
# View database in browser
npx prisma studio
# Opens http://localhost:5555
```

---

## 🎯 Next Steps

### Client Profile Management

- [ ] Update client profile endpoint
- [ ] Upload profile picture (Supabase Storage)
- [ ] Change password functionality
- [ ] Delete account endpoint

### Provider Validation

- [ ] Admin endpoint to approve/reject providers
- [ ] Admin endpoint to approve/reject companies
- [ ] Notification system for status changes
- [ ] Document verification workflow

---

## 🔒 Security Implementation

### Current Security Measures

- ✅ JWT tokens with ES256 algorithm (asymmetric encryption)
- ✅ Tokens verified via Supabase Auth
- ✅ Role-based access control (RBAC)
- ✅ Environment variables for sensitive data
- ✅ Password hashing (handled by Supabase)
- ✅ Email verification required
- ✅ Account status validation

---

## 🐛 Known Issues & Solutions

### Issue 1: JWT Token Verification Failed (RESOLVED ✅)

**Problem:** Initial implementation used HS256, but Supabase uses ES256  
**Solution:** Updated JWT strategy to verify tokens via Supabase Auth API

### Issue 2: First-time Registration Error (RESOLVED ✅)

**Problem:** User not found in database during first registration  
**Solution:** Modified JWT strategy to allow token verification before user creation

---

## 📝 Changelog

### Version 0.1.0 (Current) - Authentication Foundation

- ✅ Supabase project setup and configuration
- ✅ NestJS project initialization
- ✅ Prisma schema with multi-role user system
- ✅ JWT authentication with ES256
- ✅ Role-based access control
- ✅ Complete registration flow
- ✅ Postman collection for testing

---
