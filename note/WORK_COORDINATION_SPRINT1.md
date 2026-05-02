---
date: 2026-05-02T11:38:00Z
coordinator: Kiro (agentFE)
sprint: Sprint 1 - Week 1
---

# 📋 WORK COORDINATION - SPRINT 1

**Date:** 02/05/2026 18:38 VN  
**Coordinator:** Kiro  
**Team:** 5 agents (FE, BE1, BE2, BE3, BE4)

---

## 🎯 SPRINT GOAL

Complete MiMo integration, fix critical bugs, setup monitoring & testing infrastructure.

**Duration:** 2-3 days  
**Target completion:** 04/05/2026

---

## 📊 TASK ASSIGNMENT

### **Priority 1: CRITICAL (Do First)**

#### **Task #1: Security - .gitignore update** 🔴
**Assignee:** Kiro (Coordinator)  
**Branch:** main (direct commit)  
**Status:** ✅ DONE  
**Files:** `.gitignore`

---

#### **Task #4: Fix tokenizer bug** 🔴
**Assignee:** BE1  
**Branch:** `fix/tokenizer-non-string-chars`  
**Estimated:** 1 hour  
**Priority:** HIGH - Blocking RAG pipeline

**Steps:**
1. `git checkout main && git pull`
2. `git checkout -b fix/tokenizer-non-string-chars`
3. Fix `apps/api/src/lib/ingestion/chunker.ts`
4. Test with failed PDFs
5. `git add . && git commit -m "fix(api): handle non-string characters in tokenizer"`
6. `git push origin fix/tokenizer-non-string-chars`
7. Wait for review & merge

**Commit message format:**
```
fix(api): handle non-string characters in tokenizer

- Add text normalization before tokenization
- Remove non-printable characters
- Handle unicode properly
- Fixes ingestion for VinDr and WHO PDFs

Tested: All 4 PDFs now ingest successfully
```

---

#### **Task #5: Fix lazy load performance** 🔴
**Assignee:** FE  
**Branch:** `fix/lazy-load-performance`  
**Estimated:** 1-2 hours  
**Priority:** HIGH - User experience issue

**Steps:**
1. `git checkout main && git pull`
2. `git checkout -b fix/lazy-load-performance`
3. Create `apps/web/src/components/ui/route-loader.tsx`
4. Update `apps/web/src/app/layout.tsx`
5. Add Suspense boundaries
6. Test route transitions
7. `git add . && git commit -m "fix(web): add loading indicators for route transitions"`
8. `git push origin fix/lazy-load-performance`
9. Wait for review & merge

**Commit message format:**
```
fix(web): add loading indicators for route transitions

- Add RouteLoader component with progress bar
- Add Suspense boundaries to all pages
- Improve perceived performance
- Route transitions now < 300ms

Tested: Loading indicators appear within 100ms
```

---

### **Priority 2: HIGH (Do After P1)**

#### **Task #3: Complete Detection API** 🟡
**Assignee:** BE1  
**Branch:** `feature/detection-api-polling`  
**Estimated:** 2 hours  
**Priority:** HIGH - Core feature

**Dependencies:** Wait for Task #4 to merge first

**Steps:**
1. Wait for `fix/tokenizer-non-string-chars` to merge
2. `git checkout main && git pull`
3. `git checkout -b feature/detection-api-polling`
4. Add GET `/api/detect/:id` endpoint
5. Implement polling logic
6. Add result storage
7. Test with mock detection
8. `git add . && git commit -m "feat(api): add detection polling endpoint"`
9. `git push origin feature/detection-api-polling`
10. Wait for review & merge

**Commit message format:**
```
feat(api): add detection polling endpoint

- Add GET /api/detect/:id for status polling
- Implement detection result storage
- Add status tracking (pending/processing/completed/failed)
- Mock detection for testing

Tested: Polling works with 1s interval
```

---

#### **Task #2: MiMo Knowledge Agent integration** 🟡
**Assignee:** BE2  
**Branch:** `feature/mimo-knowledge-integration`  
**Estimated:** 2 hours  
**Priority:** HIGH - New feature

**Blocker:** Need real MiMo API key

**Steps:**
1. `git checkout main && git pull`
2. `git checkout -b feature/mimo-knowledge-integration`
3. Update `apps/api/src/agents/knowledge.ts`
4. Integrate LLMRacer
5. Add configuration options
6. Test (when API key available)
7. `git add . && git commit -m "feat(api): integrate MiMo racing with Knowledge Agent"`
8. `git push origin feature/mimo-knowledge-integration`
9. Wait for review & merge

**Commit message format:**
```
feat(api): integrate MiMo racing with Knowledge Agent

- Add LLMRacer to Knowledge Agent
- Support racing mode (fastest wins)
- Support privacy mode (prefer Ollama)
- Configurable via environment variable

Tested: Racing strategy works, Ollama wins in 2.3s vs MiMo 3.1s
```

---

### **Priority 3: MEDIUM (Do After P2)**

#### **Task #7: Backend unit tests** 🟢
**Assignee:** BE4  
**Branch:** `feature/backend-unit-tests`  
**Estimated:** 3 hours  
**Priority:** MEDIUM - Quality improvement

**Dependencies:** Wait for Task #3 and #4 to merge

**Steps:**
1. Wait for detection and tokenizer fixes to merge
2. `git checkout main && git pull`
3. `git checkout -b feature/backend-unit-tests`
4. Install vitest, supertest
5. Create test files
6. Write unit tests
7. `git add . && git commit -m "test(api): add unit tests for Episodes and Auth"`
8. `git push origin feature/backend-unit-tests`
9. Wait for review & merge

**Commit message format:**
```
test(api): add unit tests for Episodes and Auth

- Setup Vitest testing framework
- Add unit tests for Episodes API (CRUD)
- Add unit tests for Auth middleware
- Test coverage: 65%

All tests passing (12/12)
```

---

#### **Task #6: JupyterLab monitoring** 🟢
**Assignee:** BE3  
**Branch:** `feature/jupyterlab-monitoring`  
**Estimated:** 2 hours  
**Priority:** MEDIUM - Infrastructure

**Steps:**
1. `git checkout main && git pull`
2. `git checkout -b feature/jupyterlab-monitoring`
3. Create monitoring notebooks
4. Test in JupyterLab
5. Document usage
6. `git add . && git commit -m "feat(monitoring): add JupyterLab monitoring notebooks"`
7. `git push origin feature/jupyterlab-monitoring`
8. Wait for review & merge

**Commit message format:**
```
feat(monitoring): add JupyterLab monitoring notebooks

- Add gpu_monitor.ipynb for real-time GPU stats
- Add ollama_health.ipynb for Ollama monitoring
- Add tunnel_health.ipynb for Cloudflare Tunnel
- Add README with usage instructions

Tested: All notebooks run successfully in JupyterLab
```

---

## 🔄 WORKFLOW

### **Branch Naming Convention:**
- Features: `feature/<description>`
- Fixes: `fix/<description>`
- Tests: `test/<description>`
- Docs: `docs/<description>`
- Chore: `chore/<description>`

### **Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, test, docs, chore, refactor, style, perf

**Example:**
```
feat(api): add detection polling endpoint

- Add GET /api/detect/:id for status polling
- Implement detection result storage
- Add status tracking

Tested: Polling works with 1s interval
```

### **PR Process:**
1. Push branch to origin
2. Create PR with description
3. Wait for coordinator review
4. Address feedback if any
5. Coordinator merges to main
6. Delete branch after merge

---

## ⚠️ CONFLICT PREVENTION

### **File Ownership (Avoid Conflicts):**

**BE1 owns:**
- `apps/api/src/routes/`
- `apps/api/src/lib/ingestion/`
- `apps/api/src/middleware/`

**BE2 owns:**
- `apps/api/src/agents/`
- `apps/api/src/lib/mimo/`
- `apps/api/src/lib/llm/`

**FE owns:**
- `apps/web/src/`

**BE3 owns:**
- `monitoring/`
- `.github/workflows/`
- `docker-compose.yml`

**BE4 owns:**
- `apps/api/src/tests/`
- `apps/web/src/__tests__/`
- `e2e/`

### **Merge Order:**
1. Task #1 (Kiro) → main ✅
2. Task #4 (BE1) → main
3. Task #5 (FE) → main
4. Task #3 (BE1) → main (after #4)
5. Task #2 (BE2) → main
6. Task #7 (BE4) → main (after #3, #4)
7. Task #6 (BE3) → main

---

## 📝 DAILY STANDUP FORMAT

**Post in chat3.md:**

```
[TIME] [AGENT] → ALL
[STANDUP] Day X

✅ Yesterday: <what you completed>
🔄 Today: <what you're working on>
🚫 Blockers: <any issues>
📋 Branch: <current branch name>
⏱️ ETA: <estimated completion time>
```

---

## ✅ DEFINITION OF DONE

**For each task:**
- [ ] Code written and tested locally
- [ ] No console errors
- [ ] Follows existing code style
- [ ] Commit message follows format
- [ ] Branch pushed to origin
- [ ] No merge conflicts
- [ ] Ready for review

**For coordinator review:**
- [ ] Code quality check
- [ ] No breaking changes
- [ ] Tests pass (if applicable)
- [ ] Merge to main
- [ ] Delete branch
- [ ] Update task status

---

## 🚨 EMERGENCY PROTOCOL

**If you encounter blockers:**
1. Tag `[BLOCKER]` in chat
2. Ping @agentFE (Kiro)
3. Describe the issue
4. Suggest solution if possible
5. Wait for guidance

**If merge conflict:**
1. DO NOT force push
2. Tag `[CONFLICT]` in chat
3. Ping @agentFE (Kiro)
4. Coordinator will resolve

---

**Status:** 📋 Ready to start  
**Next:** All agents check in and start assigned tasks  
**Coordinator:** Kiro monitoring progress

