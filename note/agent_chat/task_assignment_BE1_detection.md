---
timestamp: 2026-05-02T11:56:30Z
from: Kiro (Coordinator)
to: BE1 (agentBE)
type: TASK_ASSIGNMENT
---

# 🎯 TASK ASSIGNMENT - BE1 (Task #3)

**Agent:** BE1 (Backend Core Developer)  
**Task:** #3 - Complete Detection API polling endpoint  
**Priority:** 🟡 HIGH  
**Estimated:** 2 hours  
**Branch:** `feature/detection-api-polling`

---

## 📋 TASK DETAILS

**Goal:**
- Complete Detection API with polling endpoint
- Add detection result storage
- Implement status tracking

**Current status:**
- POST /api/detect (mock) ✅ Done
- GET /api/detect/:id (polling) ❌ Not done

---

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create branch**
```bash
git checkout main
git pull origin main
git checkout -b feature/detection-api-polling
```

### **Step 2: Create polling endpoint**

**File:** `apps/api/src/routes/detect.ts` (update existing)

Add GET endpoint:

```typescript
/**
 * GET /api/detect/:id
 * Poll detection status and get results
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get detection from database
    const { data: detection, error } = await supabase
      .from('detections')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !detection) {
      return res.status(404).json({
        error: 'Detection not found',
        id
      });
    }
    
    res.json({
      detection: {
        id: detection.id,
        status: detection.status, // pending, processing, completed, failed
        result: detection.result,
        confidence: detection.confidence,
        findings: detection.findings,
        created_at: detection.created_at,
        completed_at: detection.completed_at,
        error: detection.error
      }
    });
  } catch (error) {
    logger.error('Detection polling error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### **Step 3: Update detection storage**

Ensure detections table has these columns:
- id (uuid)
- image_id (uuid, foreign key)
- status (enum: pending, processing, completed, failed)
- result (jsonb)
- confidence (float)
- findings (text[])
- created_at (timestamp)
- completed_at (timestamp)
- error (text)

### **Step 4: Update POST endpoint to store detection**

```typescript
// In POST /api/detect
const { data: detection, error: detectionError } = await supabase
  .from('detections')
  .insert({
    image_id: imageId,
    status: 'processing',
    result: mockResult, // Replace with real PCXR when available
    confidence: 0.85,
    findings: ['Mock finding 1', 'Mock finding 2']
  })
  .select()
  .single();
```

### **Step 5: Test locally**

```bash
# Start server
cd apps/api
yarn dev

# Test POST
curl -X POST http://localhost:3005/api/detect \
  -H "Content-Type: application/json" \
  -d '{"image_id": "test-uuid"}'

# Test GET (use ID from POST response)
curl http://localhost:3005/api/detect/{detection-id}
```

### **Step 6: Commit**

```bash
git add apps/api/src/routes/detect.ts
git commit -m "feat(api): add detection polling endpoint

- Add GET /api/detect/:id for status polling
- Implement detection result storage in database
- Add status tracking (pending/processing/completed/failed)
- Return detection results with confidence and findings

Tested: Polling works with 1s interval
Mock: Using mock detection until PCXR model ready
API: RESTful design with proper status codes"
```

### **Step 7: Push**

```bash
git push origin feature/detection-api-polling
```

### **Step 8: Report completion**

Post in chat:
```
[TIME] BE1 → ALL
[COMPLETE] Task #3 - Detection API polling

✅ Added: GET /api/detect/:id endpoint
✅ Implemented: Detection result storage
✅ Added: Status tracking (pending/processing/completed/failed)
✅ Tested: Polling works correctly
✅ Branch: feature/detection-api-polling
✅ Pushed: Ready for review

Files changed:
- apps/api/src/routes/detect.ts (modified, +45 lines)

Waiting for coordinator review and merge.
```

---

## ✅ DEFINITION OF DONE

- [x] GET /api/detect/:id endpoint created
- [x] Detection result storage implemented
- [x] Status tracking working
- [x] Proper error handling
- [x] Tested locally
- [x] Commit message follows format
- [x] Branch pushed to origin
- [x] Ready for review

---

## 🚨 IF YOU ENCOUNTER ISSUES

**Blocker:** Tag `[BLOCKER]` and ping @agentFE

**Questions:** Tag `[QUESTION]` and describe issue

**Database schema issues:** Check migration 002

---

**Start time:** 11:56 VN  
**Expected completion:** 13:56 VN  
**Status:** 🔄 ASSIGNED - Waiting for BE1 to start

