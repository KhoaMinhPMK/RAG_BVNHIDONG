---
noteId: "backend-integration-status-20260502"
tags: ["integration", "frontend", "backend", "status"]
created: 2026-05-02T11:24:00Z
---

# 📊 TRẠNG THÁI BACKEND INTEGRATION - FRONTEND

**Thời gian:** 2026-05-02 11:24 UTC (18:24 VN)  
**Người đánh giá:** BE1 (agentBE)

---

## ✅ ĐÃ GẮN BACKEND (WORKING)

### **1. Worklist Page (`/` - page.tsx)**

**Status:** ✅ **FULLY INTEGRATED**

**Backend APIs đã gắn:**
- ✅ `getEpisodes()` - GET /api/episodes
- ✅ Auto-refresh mỗi 30s
- ✅ Loading states (EpisodeListSkeleton)
- ✅ Error handling (NetworkError)
- ✅ Transform API data → UI data

**Code evidence:**
```typescript
// Line 59: Real API call
const response = await getEpisodes({ limit: 50 });

// Line 61-63: Handle real data
if (response.success && response.episodes) {
  const transformed = response.episodes.map(transformEpisode);
  setEpisodes(transformed);
}
```

**Data flow:**
1. ✅ Fetch từ backend (10 episodes seeded)
2. ✅ Transform: `episode_id`, `patient_ref`, `admission_date` → UI format
3. ✅ Display với real data
4. ✅ Stats cards tính từ real data
5. ✅ Filter tabs hoạt động với real data

**Test status:** ✅ Ready to test với 10 seeded episodes

---

## ⚠️ ĐANG MOCK (CHƯA GẮN BACKEND)

### **2. Case Detail Page (`/cases/[id]` - page.tsx)**

**Status:** ⚠️ **PARTIALLY INTEGRATED**

**Đã gắn backend:**
- ✅ `getEpisodeDetail()` - GET /api/episodes/:id (line 16)
- ✅ API client imported

**Vẫn đang mock:**
- ❌ **Detection results** - Dùng PCXR_SAMPLES hardcoded (line 41-78)
- ❌ **Patient info** - Dùng MOCK_CASE (line 103-107)
- ❌ **Explanation** - Dùng EXPLANATION_TEXT hardcoded (line 135-139)
- ❌ **Draft fields** - Dùng INITIAL_DRAFT hardcoded (line 141-147)
- ❌ **Citations** - Dùng CITATIONS_DATA hardcoded (line 126-133)
- ❌ **Knowledge Agent chat** - Chưa gắn POST /api/query

**Code evidence:**
```typescript
// Line 41: Mock PCXR samples
const PCXR_SAMPLES: PcxrSample[] = [
  { idx: 0, key: '01', imageId: 'imgid_336', imgSrc: '/pcxr/01_...', ... },
  // ... 9 more samples
];

// Line 103: Mock patient data
const MOCK_CASE = {
  patientRef: 'BN-2024-010', age: '3 tuổi', gender: 'Nam',
  date: '01/05/2024', symptoms: 'Sốt 3 ngày, ho, thở nhanh',
  spo2: '94%', crp: '45.2 mg/L',
};

// Line 135: Mock explanation
const EXPLANATION_TEXT = `Hình ảnh X-quang ngực cho thấy...`;
```

**Cần integrate:**
1. ❌ Detection results từ GET /api/episodes/:id/detection/status
2. ❌ Patient info từ GET /api/episodes/:id
3. ❌ Explanation từ POST /api/explain (chưa có backend endpoint)
4. ❌ Draft từ POST /api/draft (chưa có backend endpoint)
5. ❌ Knowledge Agent chat từ POST /api/query

---

### **3. Upload Page (`/cases/new` - page.tsx)**

**Status:** ❌ **FULLY MOCK**

**Chưa gắn backend:**
- ❌ File upload - Chưa dùng POST /api/episodes/upload
- ❌ Episode creation - Chưa dùng POST /api/episodes
- ❌ Presigned URLs - Chưa implement
- ❌ Progress tracking - Mock simulation (line 95-100)

**Code evidence:**
```typescript
// Line 88-100: Mock upload simulation
const handleSubmit = () => {
  setSubmitting(true);
  setUploadStatus('uploading');
  setUploadProgress(0);
  
  // Simulate upload progress
  const interval = setInterval(() => {
    setUploadProgress(prev => {
      if (prev === null) return 0;
      if (prev >= 100) {
        clearInterval(interval);
        setUploadStatus('processing');
        // ... mock processing
      }
      return prev + 10;
    });
  }, 300);
};
```

**Cần integrate:**
1. ❌ POST /api/episodes - Create episode với patient info
2. ❌ POST /api/episodes/upload - Upload images với presigned URLs
3. ❌ Real progress tracking từ backend
4. ❌ Error handling từ backend

---

### **4. Knowledge Page (`/knowledge` - page.tsx)**

**Status:** ❌ **FULLY MOCK**

**Chưa gắn backend:**
- ❌ Document list - Dùng mockDocs (line 3-8)
- ❌ Stats - Hardcoded (line 43)
- ❌ Search - Disabled
- ❌ Upload - Disabled

**Code evidence:**
```typescript
// Line 3: Mock documents
const mockDocs = [
  { id: 1, title: 'WHO Pneumonia Guidelines 2023', source: 'WHO', type: 'Guideline', chunks: 142, status: 'active', updated: '2024-01-10' },
  { id: 2, title: 'BTS Paediatric Pneumonia 2022', source: 'BTS', type: 'Protocol', chunks: 89, status: 'active', updated: '2024-01-08' },
  // ...
];

// Line 99: Explicitly states mock
<p className="text-[10px] text-text-tertiary text-center">
  Document Sourcing Agent + upload pipeline chưa implement · Coming Sprint 2
</p>
```

**Cần integrate:**
1. ❌ GET /api/documents - List documents (Phase 4 - chưa làm)
2. ❌ Document stats từ database
3. ❌ Search functionality
4. ❌ Upload functionality

---

## 📊 TỔNG KẾT

### **Integration Status:**

| Page | Status | Backend APIs | Mock Data | Priority |
|------|--------|--------------|-----------|----------|
| **Worklist** (`/`) | ✅ **100%** | GET /api/episodes | None | ✅ DONE |
| **Case Detail** (`/cases/[id]`) | ⚠️ **20%** | GET /api/episodes/:id | Detection, Explanation, Draft, Citations | 🔴 HIGH |
| **Upload** (`/cases/new`) | ❌ **0%** | None | All | 🟡 MEDIUM |
| **Knowledge** (`/knowledge`) | ❌ **0%** | None | All | 🟢 LOW |

### **Backend APIs Available:**

| Endpoint | Status | Used By | Integration Status |
|----------|--------|---------|-------------------|
| GET /api/episodes | ✅ Ready | Worklist | ✅ Integrated |
| GET /api/episodes/:id | ✅ Ready | Case Detail | ⚠️ Imported but not used |
| POST /api/episodes | ✅ Ready | Upload | ❌ Not integrated |
| PATCH /api/episodes/:id | ✅ Ready | - | ❌ Not integrated |
| POST /api/episodes/:id/detect | ✅ Ready | Case Detail | ❌ Not integrated |
| GET /api/episodes/:id/detection/status | ✅ Ready | Case Detail | ❌ Not integrated |
| POST /api/query | ✅ Ready | Case Detail (chat) | ❌ Not integrated |
| POST /api/episodes/upload | ✅ Ready | Upload | ❌ Not integrated |
| GET /api/documents | ❌ Not built | Knowledge | ❌ Not available |

---

## 🎯 INTEGRATION ROADMAP

### **Priority 1: Case Detail Detection (HIGH)**

**Mục tiêu:** Replace mock detection với real backend

**Tasks:**
1. ✅ Backend ready: POST /api/episodes/:id/detect
2. ✅ Backend ready: GET /api/episodes/:id/detection/status
3. ❌ Frontend: Call detect API khi user click "Phân tích"
4. ❌ Frontend: Poll status mỗi 2s
5. ❌ Frontend: Display real detection results
6. ❌ Frontend: Update UI với real bounding boxes

**ETA:** 1-2 giờ

---

### **Priority 2: Case Detail Knowledge Agent (HIGH)**

**Mục tiêu:** Replace mock chat với real Knowledge Agent

**Tasks:**
1. ✅ Backend ready: POST /api/query
2. ✅ Backend ready: 50 chunks in database
3. ❌ Frontend: Call query API khi user send message
4. ❌ Frontend: Display real citations
5. ❌ Frontend: Handle loading states
6. ❌ Frontend: Handle errors

**ETA:** 1 giờ

---

### **Priority 3: Upload Flow (MEDIUM)**

**Mục tiêu:** Replace mock upload với real backend

**Tasks:**
1. ✅ Backend ready: POST /api/episodes
2. ✅ Backend ready: POST /api/episodes/upload
3. ❌ Frontend: Create episode với patient info
4. ❌ Frontend: Upload images với presigned URLs
5. ❌ Frontend: Track real progress
6. ❌ Frontend: Navigate to case detail sau khi upload

**ETA:** 2-3 giờ

---

### **Priority 4: Case Detail Patient Info (MEDIUM)**

**Mục tiêu:** Replace MOCK_CASE với real episode data

**Tasks:**
1. ✅ Backend ready: GET /api/episodes/:id
2. ❌ Frontend: Fetch episode detail on page load
3. ❌ Frontend: Display real patient info
4. ❌ Frontend: Remove MOCK_CASE constant

**ETA:** 30 phút

---

### **Priority 5: Knowledge Page (LOW)**

**Mục tiêu:** Replace mock documents với real data

**Tasks:**
1. ❌ Backend: Build GET /api/documents (Phase 4 - deferred)
2. ❌ Frontend: Fetch real documents
3. ❌ Frontend: Display real stats
4. ❌ Frontend: Enable search/upload

**ETA:** 2-3 giờ (after backend Phase 4)

---

## 🚀 RECOMMENDED NEXT STEPS

### **For Frontend (FE):**

**Immediate (Today):**
1. ✅ Test Worklist với 10 seeded episodes
2. 🔴 Integrate Case Detail detection polling
3. 🔴 Integrate Knowledge Agent chat
4. 🟡 Integrate patient info display

**Tomorrow:**
1. 🟡 Integrate Upload flow
2. 🟡 E2E testing
3. 🟢 Knowledge page (after BE Phase 4)

### **For Backend (BE1):**

**Status:** ✅ All required APIs ready
- Episodes API ✅
- Detection API ✅
- Knowledge Agent API ✅
- Upload API ✅

**Optional (Phase 4):**
- ⏳ Admin API (GET /api/documents) - deferred

---

## 📝 NOTES

1. **Worklist page hoạt động 100%** - Frontend có thể test ngay với 10 episodes
2. **Case Detail có API client** nhưng chưa dùng - cần integrate
3. **Upload page hoàn toàn mock** - cần integrate full flow
4. **Knowledge page chờ Phase 4** - không block critical features

**Ưu tiên:** Case Detail detection + Knowledge Agent (HIGH priority)

---

**END OF INTEGRATION STATUS REPORT**
