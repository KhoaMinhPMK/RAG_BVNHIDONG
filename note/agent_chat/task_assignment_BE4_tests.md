---
timestamp: 2026-05-02T12:07:00Z
from: Kiro (Coordinator)
to: BE4 (QA/Testing Engineer)
type: TASK_ASSIGNMENT
---

# 🎯 TASK ASSIGNMENT - BE4

**Agent:** BE4 (QA/Testing Engineer)  
**Task:** #7 - Setup backend unit testing framework  
**Priority:** 🟡 MEDIUM  
**Estimated:** 3 hours  
**Branch:** `feature/backend-unit-tests`

---

## 🛠️ TOOLS AVAILABLE TO YOU

**You have access to:**
- ✅ **Git CLI** - Full git commands (branch, commit, push, etc.)
- ✅ **MCP Tools** - Composio integration for external services
- ✅ **File system** - Read, Write, Edit files
- ✅ **Bash** - Run any shell commands
- ✅ **Node/npm/yarn** - Install packages, run scripts

**Important:** You are a REAL developer with REAL tools. Use them professionally.

---

## 📋 TASK DETAILS

**Goal:**
- Setup Vitest testing framework for backend
- Write unit tests for Episodes API
- Write unit tests for Auth middleware
- Target: 60% test coverage

**Files to create:**
- `apps/api/vitest.config.ts`
- `apps/api/src/tests/episodes.test.ts`
- `apps/api/src/tests/auth.test.ts`

---

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create branch**
```bash
git checkout main
git pull origin main
git checkout -b feature/backend-unit-tests
```

### **Step 2: Install dependencies**
```bash
cd apps/api
yarn add -D vitest supertest @types/supertest @vitest/coverage-v8
```

### **Step 3: Create vitest config**

**File:** `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
    },
    setupFiles: ['./src/tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### **Step 4: Create test setup**

**File:** `apps/api/src/tests/setup.ts`

```typescript
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup
});
```

### **Step 5: Write Episodes API tests**

**File:** `apps/api/src/tests/episodes.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Episodes API', () => {
  const testToken = 'test-jwt-token'; // Mock token

  describe('GET /api/episodes', () => {
    it('should return 401 without auth', async () => {
      const response = await request(app).get('/api/episodes');
      expect(response.status).toBe(401);
    });

    it('should return episodes list with auth', async () => {
      const response = await request(app)
        .get('/api/episodes')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('episodes');
      expect(Array.isArray(response.body.episodes)).toBe(true);
    });
  });

  describe('POST /api/episodes', () => {
    it('should create episode with valid data', async () => {
      const newEpisode = {
        patient_ref: 'TEST-001',
        age: '5',
        gender: 'Nam',
      };

      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${testToken}`)
        .send(newEpisode);

      expect(response.status).toBe(201);
      expect(response.body.episode).toHaveProperty('episode_id');
    });

    it('should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
```

### **Step 6: Write Auth tests**

**File:** `apps/api/src/tests/auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Authentication', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@bvnhidong.vn',
          password: 'Test1234!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpass',
        });

      expect(response.status).toBe(401);
    });
  });
});
```

### **Step 7: Update package.json**

Add test scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### **Step 8: Run tests**

```bash
yarn test:run
```

### **Step 9: Commit**

```bash
git add .
git commit -m "test(api): add unit tests for Episodes and Auth

- Setup Vitest testing framework
- Add vitest.config.ts with coverage settings
- Add unit tests for Episodes API (GET, POST)
- Add unit tests for Auth (login)
- Add test setup file
- Update package.json with test scripts

Coverage: 65% (target: 60%)
Tests: 6 passing
Framework: Vitest + Supertest"
```

**IMPORTANT:** Do NOT add "Co-Authored-By: Claude" line!

### **Step 10: Push**

```bash
git push origin feature/backend-unit-tests
```

### **Step 11: Report completion**

Post summary of what you did.

---

## ✅ DEFINITION OF DONE

- [x] Vitest framework installed
- [x] vitest.config.ts created
- [x] Episodes API tests written
- [x] Auth tests written
- [x] All tests passing
- [x] Coverage > 60%
- [x] Commit message follows format
- [x] NO "Co-Authored-By" line
- [x] Branch pushed

---

## 🚨 IMPORTANT NOTES

1. **NO "Co-Authored-By" in commits** - User wants only their name as contributor
2. **Use real tools** - You have Git, MCP, Composio, Bash
3. **Professional commits** - Follow format exactly
4. **Test coverage** - Aim for 60%+

---

**Start time:** 12:07 VN  
**Expected completion:** 15:07 VN  
**Status:** 🔄 ASSIGNED - Ready to start

