---
noteId: "frontend_integration_guide"
tags: ["frontend", "integration", "auth", "api"]
---

# Frontend Integration Guide

**Date:** 2026-05-01  
**For:** agentUI  
**Backend Status:** ✅ Ready (port 3005)  
**Test Users:** ✅ Created (4 users with different roles)

---

## 🚨 CRITICAL FIXES NEEDED

### Fix 1: Auth Context - Wrong Column Name

**File:** `apps/web/src/contexts/auth-context.tsx`  
**Line:** 54  
**Problem:** Query uses `id` but profiles table uses `user_id` as primary key

**Current (WRONG):**
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)  // ❌ Wrong column name
  .single();
```

**Fix to:**
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', userId)  // ✅ Correct column name
  .single();
```

### Fix 2: API Client - Wrong Port

**File:** `apps/web/src/lib/api/client.ts`  
**Line:** 8  
**Problem:** Backend runs on port 3005, not 3001

**Current (WRONG):**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**Fix to:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
```

**Also add to `.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:3005
```

---

## 📋 Test Users

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| admin@bvnhidong.vn | Test1234! | admin | All permissions |
| clinician@bvnhidong.vn | Test1234! | clinician | query, explain, draft:create |
| radiologist@bvnhidong.vn | Test1234! | radiologist | query, explain, draft:create, draft:approve |
| researcher@bvnhidong.vn | Test1234! | researcher | query, explain only |

---

## 🔐 Authentication Flow

### Step 1: User Login

**Frontend (already implemented in `login/page.tsx`):**
```typescript
const { signIn } = useAuth();
const { error } = await signIn(email, password);
```

**What happens:**
1. Frontend calls `supabase.auth.signInWithPassword()`
2. Supabase validates credentials
3. Returns JWT token in session
4. Auth context fetches user profile from `profiles` table
5. Profile contains `role` field for RBAC

### Step 2: Store Session

**Automatic via Supabase:**
- JWT token stored in localStorage
- Session auto-refreshed before expiry
- `onAuthStateChange` listener updates context

### Step 3: Make API Calls

**Frontend (already implemented in `lib/api/client.ts`):**
```typescript
import { queryKnowledge } from '@/lib/api/client';

const response = await queryKnowledge(
  "Triệu chứng viêm phổi ở trẻ em là gì?",
  "episode-123"
);

if (response.success) {
  console.log(response.answer);
  console.log(response.citations);
}
```

**What happens:**
1. `getAuthToken()` fetches JWT from Supabase session
2. Adds `Authorization: Bearer <token>` header
3. Backend validates token via `authenticateJWT` middleware
4. Backend checks permission via `requirePermission` middleware
5. Backend runs guardrails validation
6. Backend logs audit trail
7. Backend returns response or 403 error

---

## 🎯 Role-Based UI Rendering

### Example: Conditional Button Rendering

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';

export function ActionButtons() {
  const { role } = useAuth();

  return (
    <div className="flex gap-2">
      {/* All roles can query */}
      <button>Query Knowledge</button>
      
      {/* All roles can explain */}
      <button>Explain Detection</button>
      
      {/* Only clinician, radiologist, admin can create draft */}
      {role && ['clinician', 'radiologist', 'admin'].includes(role) && (
        <button>Create Draft</button>
      )}
      
      {/* Only radiologist and admin can approve */}
      {role && ['radiologist', 'admin'].includes(role) && (
        <button>Approve Draft</button>
      )}
      
      {/* Only admin can view audit logs */}
      {role === 'admin' && (
        <button>View Audit Logs</button>
      )}
    </div>
  );
}
```

### Permission Helper Function

**Create:** `apps/web/src/lib/permissions.ts`

```typescript
import { Role } from '@/contexts/auth-context';

type Permission = 
  | 'query:knowledge'
  | 'explain:detection'
  | 'draft:create'
  | 'draft:approve'
  | 'audit:view';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  clinician: ['query:knowledge', 'explain:detection', 'draft:create'],
  radiologist: ['query:knowledge', 'explain:detection', 'draft:create', 'draft:approve'],
  researcher: ['query:knowledge', 'explain:detection'],
  admin: ['query:knowledge', 'explain:detection', 'draft:create', 'draft:approve', 'audit:view'],
};

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Usage in components:
// const { role } = useAuth();
// const canCreateDraft = hasPermission(role, 'draft:create');
```

---

## 🧪 Testing Checklist

### 1. Login Flow Test

- [ ] Login với admin@bvnhidong.vn → should succeed
- [ ] Login với wrong password → should show error
- [ ] Login với non-existent email → should show error
- [ ] After login, check `profile` in auth context has correct role
- [ ] After login, JWT token should be in localStorage

### 2. API Call Test

**Test Query Endpoint:**
```typescript
// In browser console or test page
import { queryKnowledge } from '@/lib/api/client';

const response = await queryKnowledge(
  "Triệu chứng viêm phổi ở trẻ em là gì?",
  "test-episode-001"
);

console.log(response);
// Expected: { success: true, answer: "...", citations: [...] }
```

**Test with different roles:**
- [ ] Login as researcher → call `/api/draft` → should get 403 (no permission)
- [ ] Login as clinician → call `/api/draft` → should succeed
- [ ] Login as radiologist → call `/api/draft` → should succeed

### 3. Error Handling Test

**Test 401 Unauthorized:**
```typescript
// Manually clear token
localStorage.clear();
const response = await queryKnowledge("test");
// Expected: { success: false, error: { code: 'UNAUTHORIZED' } }
```

**Test 403 Forbidden:**
```typescript
// Login as researcher, then try to create draft
const response = await generateDraft(...);
// Expected: { success: false, error: { code: 'FORBIDDEN' } }
```

### 4. Role-Based UI Test

- [ ] Login as researcher → Draft button should be hidden/disabled
- [ ] Login as clinician → Draft button should be visible
- [ ] Login as radiologist → Draft + Approve buttons visible
- [ ] Login as admin → All buttons visible

---

## 🔧 Backend API Reference

### POST /api/query

**Permission Required:** `query:knowledge`  
**Roles Allowed:** All roles

**Request:**
```json
{
  "query": "Triệu chứng viêm phổi ở trẻ em là gì?",
  "episode_id": "episode-123"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Triệu chứng viêm phổi ở trẻ em bao gồm...",
  "citations": [
    {
      "document_id": "doc-001",
      "document_title": "Hướng dẫn chẩn đoán viêm phổi",
      "version": "v2.1",
      "effective_date": "2024-01-15",
      "excerpt": "..."
    }
  ],
  "model_version": "qwen2.5:7b",
  "timestamp": "2026-05-01T22:00:00Z",
  "status": "success"
}
```

### POST /api/explain

**Permission Required:** `explain:detection`  
**Roles Allowed:** All roles

**Request:**
```json
{
  "episode_id": "episode-123",
  "detection": {
    "image_id": "img-001",
    "detections": [
      {
        "bbox": [100, 150, 200, 250],
        "label": "consolidation",
        "score": 0.92
      }
    ]
  },
  "clinical_data": {
    "age_months": 24,
    "symptoms": ["fever", "cough"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "explanation": "Phát hiện vùng đông đặc phổi...",
  "citations": [...],
  "evidence_payload": {
    "findings": ["consolidation in right lower lobe"],
    "confidence": 0.92,
    "warnings": []
  },
  "model_version": "qwen2.5:7b",
  "timestamp": "2026-05-01T22:00:00Z"
}
```

### POST /api/draft

**Permission Required:** `draft:create`  
**Roles Allowed:** clinician, radiologist, admin

**Request:**
```json
{
  "episode_id": "episode-123",
  "template_id": "template-xray-report",
  "detection": {
    "image_id": "img-001",
    "detections": [...]
  },
  "clinical_data": {...}
}
```

**Response:**
```json
{
  "success": true,
  "draft_id": "draft-456",
  "template_id": "template-xray-report",
  "episode_id": "episode-123",
  "fields": [
    {
      "field_id": "findings",
      "label": "Findings",
      "value": "Consolidation in right lower lobe...",
      "source": "ai",
      "provenance": [...],
      "status": "valid"
    }
  ],
  "status": "draft",
  "model_version": "qwen2.5:7b",
  "timestamp": "2026-05-01T22:00:00Z"
}
```

---

## 🚨 Error Codes

| Code | HTTP Status | Meaning | Action |
|------|-------------|---------|--------|
| UNAUTHORIZED | 401 | No token or invalid token | Redirect to login |
| FORBIDDEN | 403 | Valid token but no permission | Show error message |
| VALIDATION_ERROR | 400 | Invalid request body | Show validation errors |
| GUARDRAIL_VIOLATION | 400 | Content blocked by guardrails | Show specific violation |
| INTERNAL_ERROR | 500 | Server error | Show generic error, log to Sentry |

---

## 📝 Sample Test Page

**Create:** `apps/web/src/app/test-api/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { queryKnowledge, explainDetection, generateDraft } from '@/lib/api/client';

export default function TestApiPage() {
  const { user, profile, role } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testQuery = async () => {
    setLoading(true);
    const response = await queryKnowledge(
      "Triệu chứng viêm phổi ở trẻ em là gì?",
      "test-episode-001"
    );
    setResult(response);
    setLoading(false);
  };

  const testExplain = async () => {
    setLoading(true);
    const response = await explainDetection(
      "test-episode-001",
      {
        image_id: "test-img-001",
        detections: [
          { bbox: [100, 150, 200, 250], label: "consolidation", score: 0.92 }
        ]
      },
      { age_months: 24, symptoms: ["fever", "cough"] }
    );
    setResult(response);
    setLoading(false);
  };

  const testDraft = async () => {
    setLoading(true);
    const response = await generateDraft(
      "test-episode-001",
      "template-xray-report",
      {
        image_id: "test-img-001",
        detections: [
          { bbox: [100, 150, 200, 250], label: "consolidation", score: 0.92 }
        ]
      },
      { age_months: 24, symptoms: ["fever", "cough"] }
    );
    setResult(response);
    setLoading(false);
  };

  if (!user) {
    return <div className="p-8">Please login first</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <p><strong>User:</strong> {user.email}</p>
        <p><strong>Role:</strong> {role}</p>
        <p><strong>Full Name:</strong> {profile?.full_name}</p>
      </div>

      <div className="space-y-4 mb-6">
        <button
          onClick={testQuery}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Query Endpoint
        </button>

        <button
          onClick={testExplain}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Explain Endpoint
        </button>

        <button
          onClick={testDraft}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Draft Endpoint (requires permission)
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 Next Steps

1. **Fix auth context** - Change `eq('id', userId)` to `eq('user_id', userId)`
2. **Fix API client** - Change port from 3001 to 3005
3. **Create test page** - Use sample code above
4. **Test login flow** - Try all 4 test users
5. **Test API calls** - Verify permissions work correctly
6. **Test error handling** - Verify 401/403 errors handled gracefully
7. **Implement role-based UI** - Hide/disable buttons based on role

---

## 📞 Support

**Backend Issues:**
- Check backend logs: `apps/api/logs/server.log`
- Verify backend running: `curl http://localhost:3005/health`
- Contact: agentBE via `note/agent_chat/chat2.md`

**Frontend Issues:**
- Check browser console for errors
- Verify Supabase connection
- Check JWT token in localStorage
- Contact: agentUI via `note/agent_chat/chat2.md`

---

**Status:** ✅ Ready for Integration  
**Last Updated:** 2026-05-01 22:00
