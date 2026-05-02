---
noteId: "817c6930453a11f1b3ce19fa7351e6bb"
tags: []

---

# Backend Authentication Specification

**Document Version:** 1.0  
**Date:** 2026-05-01  
**Author:** agentFE  
**Target:** agentBE  

---

## Executive Summary

Backend hiện tại đã có RBAC middleware hoàn chỉnh nhưng đang dùng header `x-user-role` tạm thời (line 79-80 trong `rbac.ts`). Cần integrate Supabase Auth để:

1. **Validate JWT tokens** từ frontend
2. **Extract user_id và role** từ token
3. **Verify token signature** với Supabase
4. **Attach authenticated user** vào request object
5. **Audit logging** cho auth events

---

## Current State Analysis

### ✅ Đã có (Backend)

1. **RBAC Middleware** (`apps/api/src/middleware/rbac.ts`):
   - Permission matrix: 10 permissions
   - 4 roles: `clinician`, `radiologist`, `researcher`, `admin`
   - Functions: `requirePermission()`, `requireAnyPermission()`, `requireAllPermissions()`
   - **TODO comment line 79**: "integrate with auth system"

2. **Supabase Client** (`apps/api/src/lib/supabase/client.ts`):
   - Đã có Supabase client setup
   - Credentials trong `.env`

3. **Database Schema** (`apps/api/src/lib/supabase/schema.sql`):
   - Table `profiles` đã có (line 64-76)
   - Columns: `user_id`, `email`, `full_name`, `role`, `department`, `permissions`
   - **NHƯNG**: chưa sync với Supabase Auth (`auth.users` table)

4. **Audit Middleware** (`apps/api/src/middleware/audit.ts`):
   - Đã có audit logging
   - Cần thêm auth events (login, logout, token refresh)

5. **API Types** (`apps/api/src/types/api.ts`):
   - Type `Role` đã định nghĩa
   - Cần thêm: `AuthUser`, `AuthSession`, `TokenPayload`

### ❌ Chưa có (Cần implement)

1. **JWT Token Validation Middleware**
2. **Supabase Auth Integration**
3. **User Context Extraction**
4. **Auth Event Logging**
5. **Token Refresh Endpoint**
6. **Database Trigger** (auto-create profile khi user signup)
7. **Auth-related API Routes** (optional: `/auth/me`, `/auth/refresh`)

---

## Requirements

### FR-BE-1: JWT Token Validation Middleware

**File:** `apps/api/src/middleware/auth.ts` (NEW)

**Responsibilities:**
1. Extract `Authorization: Bearer <token>` header
2. Validate token với Supabase Auth
3. Extract user payload: `user_id`, `email`, `role`
4. Attach `req.user` và `req.userRole` cho downstream middleware
5. Handle errors: missing token, invalid token, expired token

**Error Responses:**
- `401 Unauthorized` — missing/invalid token
- `403 Forbidden` — token valid nhưng không có permission

**Example:**
```typescript
// Request
GET /api/query
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// req.user after middleware
{
  id: 'uuid-123',
  email: 'doctor@hospital.com',
  role: 'clinician',
  full_name: 'Bác sỹ Nguyễn Văn A',
  department: 'Nhi khoa'
}
```

---

### FR-BE-2: Update RBAC Middleware

**File:** `apps/api/src/middleware/rbac.ts` (MODIFY)

**Changes:**
- **Line 79-80**: Replace `req.headers['x-user-role']` với `req.userRole` (từ auth middleware)
- **Add validation**: Nếu `req.userRole` undefined → return 401
- **Keep backward compatibility** (optional): Nếu dev mode, vẫn cho phép `x-user-role` header

**Before:**
```typescript
const userRole = (req.headers['x-user-role'] as Role) || 'clinician';
```

**After:**
```typescript
const userRole = (req as any).userRole;
if (!userRole) {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
  });
}
```

---

### FR-BE-3: Supabase Auth Integration

**File:** `apps/api/src/lib/supabase/auth.ts` (NEW)

**Functions:**

#### 3.1. `verifyToken(token: string)`
```typescript
/**
 * Verify JWT token với Supabase Auth
 * @returns { user, error }
 */
export async function verifyToken(token: string): Promise<{
  user: AuthUser | null;
  error: Error | null;
}> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side key
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: error || new Error('Invalid token') };
  }

  // Fetch profile to get role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, department')
    .eq('id', user.id)
    .single();

  return {
    user: {
      id: user.id,
      email: user.email!,
      role: profile?.role || 'clinician',
      full_name: profile?.full_name || user.email!,
      department: profile?.department || null,
    },
    error: null,
  };
}
```

#### 3.2. `refreshToken(refreshToken: string)`
```typescript
/**
 * Refresh access token
 */
export async function refreshToken(refreshToken: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  return { session: data.session, error };
}
```

---

### FR-BE-4: Database Schema Update

**File:** `apps/api/src/lib/supabase/schema-auth.sql` (NEW)

**Changes:**

#### 4.1. Update `profiles` table
```sql
-- Sync với Supabase Auth
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_pkey,
  ADD PRIMARY KEY (user_id);

-- Add foreign key to auth.users
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add avatar_url column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
```

#### 4.2. Auto-create profile trigger
```sql
-- Function: auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'clinician'),
    NEW.raw_user_meta_data->>'department'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### 4.3. Row-Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update own profile (except role)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND role = (SELECT role FROM profiles WHERE user_id = auth.uid())
  );

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### FR-BE-5: Auth Event Logging

**File:** `apps/api/src/middleware/audit.ts` (MODIFY)

**Add auth events:**
```typescript
export enum AuditEventType {
  // Existing events...
  QUERY_KNOWLEDGE = 'query:knowledge',
  EXPLAIN_DETECTION = 'explain:detection',
  
  // New auth events
  AUTH_LOGIN = 'auth:login',
  AUTH_LOGOUT = 'auth:logout',
  AUTH_TOKEN_REFRESH = 'auth:token_refresh',
  AUTH_FAILED = 'auth:failed',
  AUTH_SESSION_EXPIRED = 'auth:session_expired',
}

export async function logAuthEvent(
  eventType: AuditEventType,
  userId: string | null,
  metadata: Record<string, any>
) {
  await supabase.from('audit_logs').insert({
    event_type: eventType,
    user_id: userId,
    metadata: {
      ...metadata,
      ip: metadata.ip,
      user_agent: metadata.userAgent,
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

### FR-BE-6: API Types Update

**File:** `apps/api/src/types/api.ts` (MODIFY)

**Add types:**
```typescript
// Auth User (attached to req.user)
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  department: string | null;
}

// Token Payload (JWT claims)
export interface TokenPayload {
  sub: string; // user_id
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

// Auth Session
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}
```

---

### FR-BE-7: Optional Auth Routes

**File:** `apps/api/src/routes/auth.ts` (NEW, OPTIONAL)

**Endpoints:**

#### 7.1. `GET /api/auth/me`
```typescript
/**
 * Get current user info
 * Requires: valid JWT token
 */
router.get('/me', authenticateToken, async (req, res) => {
  const user = (req as any).user as AuthUser;
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      department: user.department,
      permissions: getRolePermissions(user.role),
    },
  });
});
```

#### 7.2. `POST /api/auth/refresh`
```typescript
/**
 * Refresh access token
 * Body: { refresh_token: string }
 */
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'refresh_token required' },
    });
  }

  const { session, error } = await refreshToken(refresh_token);
  
  if (error || !session) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
    });
  }

  res.json({
    success: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    },
  });
});
```

#### 7.3. `POST /api/auth/logout`
```typescript
/**
 * Logout (invalidate token on client side)
 * Server-side: log audit event
 */
router.post('/logout', authenticateToken, async (req, res) => {
  const user = (req as any).user as AuthUser;
  
  await logAuthEvent(AuditEventType.AUTH_LOGOUT, user.id, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Logged out successfully' });
});
```

---

## Implementation Plan for agentBE

### Phase 1: Core Auth (Priority: HIGH)

**Task 1.1: Create Auth Middleware**
- File: `apps/api/src/middleware/auth.ts`
- Function: `authenticateToken(req, res, next)`
- Extract token, verify với Supabase, attach `req.user`

**Task 1.2: Create Supabase Auth Helper**
- File: `apps/api/src/lib/supabase/auth.ts`
- Functions: `verifyToken()`, `refreshToken()`

**Task 1.3: Update RBAC Middleware**
- File: `apps/api/src/middleware/rbac.ts`
- Replace `x-user-role` header với `req.userRole`
- Add validation: require `req.userRole` to be set

**Task 1.4: Update API Types**
- File: `apps/api/src/types/api.ts`
- Add: `AuthUser`, `TokenPayload`, `AuthSession`

**Task 1.5: Update Main Server**
- File: `apps/api/src/index.ts`
- Add `authenticateToken` middleware BEFORE `requirePermission`
- Order: `authenticateToken` → `requirePermission` → route handler

**Dấu hiệu hoàn thành:**
- ✅ API routes yêu cầu valid JWT token
- ✅ Invalid token → 401 Unauthorized
- ✅ Valid token → `req.user` có đầy đủ thông tin
- ✅ RBAC middleware dùng `req.userRole` thay vì header

---

### Phase 2: Database Schema (Priority: HIGH)

**Task 2.1: Create Schema Migration**
- File: `apps/api/src/lib/supabase/schema-auth.sql`
- Update `profiles` table
- Create `handle_new_user()` trigger
- Setup RLS policies

**Task 2.2: Run Migration**
- Connect to Supabase
- Execute schema-auth.sql
- Verify trigger hoạt động

**Task 2.3: Seed Test Users**
- Create 4 test users (1 per role)
- Verify profiles auto-created

**Dấu hiệu hoàn thành:**
- ✅ `profiles` table sync với `auth.users`
- ✅ Trigger auto-create profile khi signup
- ✅ RLS policies hoạt động
- ✅ Test users có đầy đủ roles

---

### Phase 3: Auth Event Logging (Priority: MEDIUM)

**Task 3.1: Update Audit Middleware**
- File: `apps/api/src/middleware/audit.ts`
- Add auth event types
- Add `logAuthEvent()` function

**Task 3.2: Integrate Auth Logging**
- Log login success (frontend sẽ call)
- Log logout (nếu có endpoint)
- Log token refresh
- Log auth failures (trong auth middleware)

**Dấu hiệu hoàn thành:**
- ✅ Auth events được ghi vào `audit_logs` table
- ✅ Include: user_id, IP, user_agent, timestamp

---

### Phase 4: Optional Auth Routes (Priority: LOW)

**Task 4.1: Create Auth Routes**
- File: `apps/api/src/routes/auth.ts`
- Endpoints: `/auth/me`, `/auth/refresh`, `/auth/logout`

**Task 4.2: Register Routes**
- File: `apps/api/src/index.ts`
- Add `app.use('/api/auth', authRoutes)`

**Dấu hiệu hoàn thành:**
- ✅ `GET /api/auth/me` trả về user info
- ✅ `POST /api/auth/refresh` refresh token thành công
- ✅ `POST /api/auth/logout` log audit event

---

## Middleware Order (CRITICAL)

**Correct order trong `index.ts`:**
```typescript
// 1. Global middleware
app.use(express.json());
app.use(cors());

// 2. Auth middleware (extract user from token)
app.use(authenticateToken); // NEW

// 3. Routes với RBAC
app.use('/api/query', requirePermission('query:knowledge'), queryRoutes);
app.use('/api/explain', requirePermission('explain:detection'), explainRoutes);
app.use('/api/draft', requirePermission('draft:create'), draftRoutes);

// 4. Public routes (no auth)
app.get('/health', healthCheck);
```

**IMPORTANT:** `authenticateToken` phải chạy TRƯỚC `requirePermission`!

---

## Environment Variables

**Add to `.env`:**
```bash
# Supabase Auth (server-side)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret (if using custom JWT)
JWT_SECRET=your_jwt_secret_here

# Session config
SESSION_TIMEOUT_HOURS=8
IDLE_TIMEOUT_MINUTES=30
```

---

## Testing Checklist

### Manual Testing
- [ ] Valid token → 200 OK, `req.user` populated
- [ ] Invalid token → 401 Unauthorized
- [ ] Expired token → 401 Unauthorized
- [ ] Missing token → 401 Unauthorized
- [ ] Valid token, wrong role → 403 Forbidden
- [ ] Refresh token → new access token
- [ ] Logout → audit log created
- [ ] New user signup → profile auto-created
- [ ] RLS policies → users can only see own profile

### Integration Testing
- [ ] Frontend login → backend validates token
- [ ] Frontend API call → token in Authorization header
- [ ] Token refresh flow → seamless
- [ ] Session timeout → 401, frontend redirects to login

---

## Security Considerations

### ✅ Must Have
1. **Use SUPABASE_SERVICE_ROLE_KEY** for server-side token validation
2. **Never expose service role key** to frontend
3. **Validate token signature** — don't trust client
4. **Rate limiting** on auth endpoints (5 req/min per IP)
5. **Audit all auth events** — login, logout, failures
6. **HTTPS only** in production
7. **Secure cookie flags** (if using cookies)

### ⚠️ Nice to Have
1. **Token blacklist** (revoked tokens)
2. **IP whitelist** for admin role
3. **Device fingerprinting**
4. **Suspicious activity detection**

---

## Error Handling

**Standard error responses:**

```typescript
// 401 Unauthorized
{
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    details: { reason: 'missing_token' | 'invalid_token' | 'expired_token' }
  }
}

// 403 Forbidden
{
  success: false,
  error: {
    code: 'FORBIDDEN',
    message: 'Permission denied',
    details: {
      requiredRoles: ['admin'],
      userRole: 'clinician'
    }
  }
}
```

---

## Dependencies

**Install:**
```bash
cd apps/api
npm install @supabase/supabase-js jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

---

## Communication Protocol

**agentBE → agentFE:**
- Ghi `[START]` vào `chat1.md` khi bắt đầu
- Ghi `[DONE]` khi hoàn thành từng phase
- Tag `@agentFE` nếu có blocker

**agentBE → agentUI:**
- Thông báo khi auth middleware ready
- Cung cấp example API calls với token
- Hướng dẫn error handling

---

## Success Criteria

### Must Have (MVP)
- ✅ JWT token validation hoạt động
- ✅ RBAC middleware dùng `req.userRole` từ token
- ✅ Database trigger auto-create profile
- ✅ RLS policies hoạt động
- ✅ Auth events được audit log
- ✅ No security vulnerabilities

### Nice to Have
- ✅ `/auth/me`, `/auth/refresh`, `/auth/logout` endpoints
- ✅ Rate limiting on auth routes
- ✅ Comprehensive error messages

---

## Estimated Effort

- **Phase 1 (Core Auth)**: 1 day
- **Phase 2 (Database)**: 0.5 day
- **Phase 3 (Audit)**: 0.5 day
- **Phase 4 (Optional Routes)**: 0.5 day
- **Total**: 2-3 days

---

## References

- Frontend Auth Plan: `C:\Users\fujitsu\.claude\plans\hi-n-t-i-v-n-ch-a-cuddly-honey.md`
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

**END OF SPECIFICATION**
