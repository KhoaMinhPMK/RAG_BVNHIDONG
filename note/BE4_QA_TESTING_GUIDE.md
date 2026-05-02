---
noteId: "be4-qa-testing-guide-20260502"
tags: ["qa", "testing", "guide", "be4"]
created: 2026-05-02T11:23:00Z
assignee: BE4 (QA/Testing Engineer)
priority: HIGH
---

# 👤 BE4 (QA/TESTING ENGINEER) - HƯỚNG DẪN CÔNG VIỆC

## Vai trò:
QA/Testing Engineer chịu trách nhiệm đảm bảo chất lượng toàn bộ hệ thống: unit tests, E2E tests, performance testing, security testing, và bug tracking.

## Scope:
- Frontend: Next.js 14 apps
- Backend: Express.js API
- Database: Supabase PostgreSQL
- AI/ML: Ollama + MiMo API
- Infrastructure: A100 server

---

## 📋 NHIỆM VỤ CHI TIẾT

### **PHASE 1: Testing Framework Setup (1-2 ngày)**

#### **Task 1.1: Unit Tests Backend**

**File:** `apps/api/src/tests/episodes.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Episodes API', () => {
  beforeEach(async () => {
    // Clear test database
    await supabase.from('episodes').delete().neq('id', '');
  });

  it('should create episode', async () => {
    const response = await request(app)
      .post('/api/episodes')
      .set('Authorization', 'Bearer test-token')
      .send({
        patient_ref: 'TEST-001',
        age: '5',
        gender: 'Nam'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.episode.id).toBeDefined();
  });

  it('should reject unauthorized request', async () => {
    const response = await request(app)
      .get('/api/episodes');
    expect(response.status).toBe(401);
  });

  it('should return episodes list', async () => {
    const response = await request(app)
      .get('/api/episodes')
      .set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.episodes)).toBe(true);
  });
});
```

**Setup:**

```bash
cd apps/api
yarn add -D vitest supertest @types/supertest
```

**File:** `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**Add scripts to package.json:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

#### **Task 1.2: Unit Tests Frontend**

**File:** `apps/web/src/components/__tests__/loading-spinner.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../ui/loading-spinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-6 w-6');
  });

  it('renders with small size', () => {
    render(<LoadingSpinner size="sm" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-4 w-4');
  });
});
```

**Setup:**

```bash
cd apps/web
yarn add -D @testing-library/react @testing-library/jest-dom vitest
```

---

#### **Task 1.3: E2E Tests (Playwright)**

**File:** `e2e/tests/worklist.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Worklist Page', () => {
  test('should load and display episodes', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Check loading state appears
    await expect(page.locator('.skeleton')).toBeVisible();
    
    // Wait for data to load
    await expect(page.locator('.episode-card')).toBeVisible({ timeout: 10000 });
    
    // Verify episodes displayed
    const episodes = await page.locator('.episode-card').count();
    expect(episodes).toBeGreaterThan(0);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/episodes', route => {
      route.fulfill({ status: 500 });
    });
    
    await page.goto('http://localhost:3001');
    
    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();
    // Should show retry button
    await expect(page.locator('button', { hasText: 'Thử lại' })).toBeVisible();
  });

  test('should navigate to case detail', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.locator('.episode-card').first().click();
    
    // Should navigate to case detail
    await expect(page).toHaveURL(/\/cases\/.*/);
    await expect(page.locator('.case-detail')).toBeVisible();
  });
});
```

**Setup:**

```bash
yarn add -D playwright @playwright/test
npx playwright install
```

---

### **PHASE 2: Performance Testing (1-2 ngày)**

#### **Task 2.1: API Performance Benchmark**

**File:** `e2e/benchmarks/api-performance.ts`

```typescript
import { test, expect } from '@playwright/test';

const API_ENDPOINTS = [
  { method: 'GET', path: '/health', maxTime: 100 },
  { method: 'GET', path: '/api/episodes', maxTime: 500 },
  { method: 'POST', path: '/api/query', maxTime: 3000 },
  { method: 'POST', path: '/api/explain', maxTime: 5000 },
  { method: 'POST', path: '/api/draft', maxTime: 8000 },
];

for (const endpoint of API_ENDPOINTS) {
  test(`${endpoint.method} ${endpoint.path} should respond within ${endpoint.maxTime}ms`, async ({ request }) => {
    const startTime = Date.now();
    const response = await request.fetch(endpoint.path, {
      method: endpoint.method,
    });
    const duration = Date.now() - startTime;
    
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(endpoint.maxTime);
  });
}
```

---

#### **Task 2.2: Load Testing**

**File:** `e2e/load-tests/api-load-test.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3005/api/episodes');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Install k6:**

```bash
brew install k6  # macOS
# or
sudo apt install k6  # Linux
```

---

#### **Task 2.3: Lighthouse Audit**

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3001 --view --output html

# CI integration
lighthouse http://localhost:3001 --output json --output-path ./reports/lighthouse.json
```

**Metrics to track:**
- Performance score > 80
- Accessibility score > 90
- Best Practices score > 90
- SEO score > 90
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Cumulative Layout Shift < 0.1
- Time to Interactive < 3.5s

---

### **PHASE 3: Security Testing (1 ngày)**

#### **Task 3.1: Penetration Testing**

```bash
# 1. SQL Injection testing
curl -X POST http://localhost:3005/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "\'; DROP TABLE episodes; --"}'

# 2. XSS testing
curl -X POST http://localhost:3005/api/episodes \
  -H "Content-Type: application/json" \
  -d '{"patient_ref": "<script>alert(1)</script>"}'

# 3. Authentication bypass testing
curl -X GET http://localhost:3005/api/episodes \
  -H "Authorization: Bearer invalid-token"

# 4. Rate limiting testing
for i in {1..200}; do
  curl -X GET http://localhost:3005/api/episodes
done
```

---

#### **Task 3.2: Vulnerability Scanning**

```bash
# 1. Dependency scanning
npm audit
yarn audit

# 2. Container scanning (if using Docker)
docker scan <image-name>

# 3. OWASP ZAP for web security
# Download: https://www.zaproxy.org/download/
# Run automated scan against localhost:3001
```

---

#### **Task 3.3: Data Privacy Testing**

**File:** `e2e/tests/privacy.spec.ts`

```typescript
test('should not expose sensitive data in logs', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  
  await page.goto('http://localhost:3001/login');
  await page.fill('input[name="email"]', 'admin@bvnhidong.vn');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  
  // Check no sensitive data in console logs
  logs.forEach(log => {
    expect(log).not.toContain('Test1234!');
    expect(log).not.toContain('admin@bvnhidong.vn');
  });
});
```

---

### **PHASE 4: Quality Monitoring (Ongoing)**

#### **Task 4.1: Bug Tracking System**

**Bug Report Template:**

```markdown
# Bug Report Template

**Bug ID:** BUG-001
**Title:** Loading spinner not showing on Worklist
**Priority:** HIGH
**Severity:** Medium
**Status:** Open
**Assigned to:** FE (agentUI)

**Steps to Reproduce:**
1. Go to Worklist page
2. Refresh page
3. Observe no loading indicator

**Expected Behavior:**
- Loading spinner should appear while data is fetching

**Actual Behavior:**
- Page appears blank/frozen

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- URL: http://localhost:3001

**Screenshots:** [attach]
**Logs:** [attach]
```

---

#### **Task 4.2: Quality Dashboard**

```typescript
// Create quality metrics dashboard
const qualityMetrics = {
  testCoverage: 85, // Target: > 80%
  bugCount: 12, // Target: < 20
  criticalBugs: 0, // Target: 0
  performanceScore: 92, // Lighthouse target: > 80
  apiResponseTime: 245, // p95 target: < 500ms
  uptime: 99.9, // Target: > 99.5%
};
```

---

#### **Task 4.3: Automated Testing Pipeline**

**File:** `.github/workflows/test.yml`

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn test:coverage
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: npx playwright install
      - run: yarn e2e
      
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx lighthouse http://localhost:3001
```

---

## 🛠️ TOOLS & TECHNOLOGIES

| Tool | Purpose | Priority |
|------|---------|----------|
| Vitest | Unit testing | HIGH |
| Playwright | E2E testing | HIGH |
| Supertest | API testing | HIGH |
| k6 | Load testing | MEDIUM |
| Lighthouse | Performance audit | HIGH |
| OWASP ZAP | Security testing | MEDIUM |
| npm audit | Dependency scanning | HIGH |
| GitHub Actions | CI testing | HIGH |
| Bug tracking | Issue management | HIGH |
| Grafana | Quality dashboard | MEDIUM |

---

## ✅ TESTING CHECKLIST

**Before each deployment:**
- [ ] Unit tests pass (coverage > 80%)
- [ ] E2E tests pass (all critical flows)
- [ ] Performance tests pass (response times within limits)
- [ ] Security scan pass (no critical vulnerabilities)
- [ ] Lighthouse score > 80
- [ ] Manual smoke test pass
- [ ] Database migration tested
- [ ] API contract tested

**Weekly:**
- [ ] Full regression test
- [ ] Load test (100 concurrent users)
- [ ] Security vulnerability scan
- [ ] Dependency audit
- [ ] Performance benchmark comparison

---

## 📊 SUCCESS CRITERIA

- ✅ Test coverage > 80%
- ✅ All E2E tests pass
- ✅ Performance targets met (Lighthouse > 80)
- ✅ 0 critical security vulnerabilities
- ✅ Bug resolution time < 24 hours
- ✅ Automated testing pipeline working
- ✅ Quality dashboard active

---

## 💬 COMMUNICATION

**Daily updates vào chat3.md:**

```
[TIME] BE4 → ALL
[UPDATE] Testing - Day X

✅ Tests written: <count>
🐛 Bugs found: <count>
📊 Coverage: <percentage>
🚫 Blocked: <what>
📋 Next: <what>
```

**Bug reports:**

```
[TIME] BE4 → ALL
[BUG] BUG-XXX - <Title>
Priority: HIGH/MEDIUM/LOW
Assigned to: <agent>
Description: <what's wrong>
```

**Blockers:** Tag `[BLOCKER]` + ping @agentFE

---

## 🤝 COORDINATION VỚI TEAM

| Với ai | Nội dung |
|--------|----------|
| Kiro (agentFE) | Báo cáo chất lượng, request resources |
| FE (agentUI) | Bug reports, UI testing coordination |
| BE1 (agentBE) | API testing, bug fixes coordination |
| BE2 (AI/ML) | Model quality testing, RAG accuracy |
| BE3 (DevOps) | Infrastructure testing, deployment validation |
| User | Quality reports, security audits |

---

## 📝 TIMELINE

**Week 1:**
- Day 1-2: Testing framework setup
- Day 3-4: Performance testing
- Day 5: Security testing

**Week 2:**
- Quality monitoring
- Bug tracking
- Documentation

**Ongoing:**
- Regression testing
- New test writing
- Bug verification

---

**Status:** 📋 Ready to start  
**Priority:** 🔴 HIGH  
**Estimated:** 4-5 days setup + ongoing testing
