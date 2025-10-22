# Password Authentication Block

Complete username/password authentication system with bcrypt hashing, session management, and React components.

## Features

- **Secure password hashing** with bcrypt (10 salt rounds)
- **Token-based sessions** with 30-day expiration
- **Express middleware** for protected routes
- **React context & hooks** for client-side auth state
- **Pre-built forms** (Login, Register) with validation
- **Protected routes** component wrapper

## What's Included

### Server (Express + Prisma)
- `auth.ts` - Core auth functions (hash, verify, sessions)
- `auth-middleware.ts` - Express middleware for protected routes
- `auth-routes.ts` - API endpoints (register, login, logout, me)

### Client (React + TypeScript)
- `useAuth.tsx` - AuthProvider context and hook
- `LoginForm.tsx` - Login form component
- `RegisterForm.tsx` - Registration form with validation
- `ProtectedRoute.tsx` - Route wrapper for authenticated content

### Database (Prisma)
- `User` model - Username, password hash, timestamps
- `Session` model - Token, expiration, user relation

## API Endpoints

### POST /api/auth/register
Create new user account

**Request:**
```json
{
  "username": "john",
  "password": "secret123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "username": "john",
    "createdAt": "2025-01-22T..."
  },
  "token": "hex-token"
}
```

### POST /api/auth/login
Authenticate user

**Request:**
```json
{
  "username": "john",
  "password": "secret123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "john",
    "createdAt": "2025-01-22T..."
  },
  "token": "hex-token"
}
```

### POST /api/auth/logout
Delete current session (requires auth)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/me
Get current user (requires auth)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "username": "john",
    "createdAt": "2025-01-22T...",
    "updatedAt": "2025-01-22T..."
  }
}
```

## Integration Guide

### 1. Install Dependencies
```bash
npm install bcryptjs @types/bcryptjs
```

### 2. Update Prisma Schema
Merge the models from `prisma/schema.prisma` into your main schema file:

```prisma
model User {
  id        String    @id @default(uuid())
  username  String    @unique
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  sessions  Session[]
}

model Session {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  expiresAt DateTime
}
```

Run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name add-auth
```

### 3. Mount Auth Router (Server)
In your `server/src/index.ts`:

```typescript
import { authRouter } from './routes/auth-routes';

// Mount auth routes
app.use('/api/auth', authRouter);
```

### 4. Wrap App with AuthProvider (Client)
In your `client/src/main.tsx`:

```typescript
import { AuthProvider } from './hooks/useAuth';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

### 5. Use in Components

**Access auth state:**
```typescript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, login, register, logout, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <LoginForm />;

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Protect routes:**
```typescript
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/LoginForm';

function App() {
  return (
    <ProtectedRoute fallback={<LoginForm />}>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

**Protected API calls (client):**
```typescript
const { token } = useAuth();

const response = await fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

**Protected routes (server):**
```typescript
import { requireAuth } from './middleware/auth-middleware';

app.get('/api/protected', requireAuth, (req, res) => {
  // req.user is available
  res.json({ user: req.user });
});
```

## Validation Rules

- **Username**: Minimum 3 characters
- **Password**: Minimum 6 characters
- **Session**: 30-day expiration (automatic cleanup on validation)

## Security Features

- ✅ Bcrypt password hashing (10 rounds)
- ✅ Cryptographically secure session tokens (32 bytes)
- ✅ Automatic session expiration
- ✅ Password never sent in responses
- ✅ Generic error messages (no username enumeration)

## Customization

### Change Session Duration
Edit `SESSION_DURATION_DAYS` in `auth.ts`:

```typescript
const SESSION_DURATION_DAYS = 30; // Change to desired days
```

### Add Password Requirements
Edit validation in `auth-routes.ts` register endpoint:

```typescript
if (password.length < 8) {
  res.status(400).json({ error: 'Password must be at least 8 characters' });
  return;
}

if (!/[A-Z]/.test(password)) {
  res.status(400).json({ error: 'Password must contain uppercase letter' });
  return;
}
```

### Cleanup Expired Sessions
Use the utility function in a cron job:

```typescript
import { cleanupExpiredSessions } from './lib/auth';

// Run daily
setInterval(async () => {
  const deleted = await cleanupExpiredSessions();
  console.log(`Cleaned up ${deleted} expired sessions`);
}, 24 * 60 * 60 * 1000);
```

## Testing

See `tests/` directory for comprehensive test suite covering:
- Password hashing and verification
- Session creation and validation
- API endpoints (register, login, logout, me)
- Middleware (requireAuth)
- Error cases and edge conditions
