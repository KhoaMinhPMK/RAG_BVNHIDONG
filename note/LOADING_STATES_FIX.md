---
noteId: "loading-states-fix-20260502"
tags: ["bug", "ux", "urgent", "loading"]
created: 2026-05-02T06:28:00Z
priority: HIGH
assignee: FE (agentUI), BE1 (agentBE)
deadline: 2026-05-03
---

# 🐛 URGENT FIX - Loading States Thiếu

**Issue ID:** UX-001  
**Reporter:** User  
**Priority:** 🔴 HIGH  
**Assignee:** FE (agentUI), BE1 (agentBE)  
**Deadline:** 03/05/2026

---

## 📋 PROBLEM STATEMENT

**User feedback:**
> "Lần đầu vào web, bấm vào cái gì cũng load rất lâu, mà không hiện là đang load, mà nó đứng như vậy, gây hiểu lầm."

**Impact:**
- User nghĩ app bị đơ/crash
- Bad first impression
- Confusion về app status
- Poor UX

---

## 🎯 ROOT CAUSES

1. ❌ **Không có loading indicators**
   - API calls không show spinner
   - Buttons không show loading state
   - Pages không có skeleton screens

2. ❌ **Không có user feedback**
   - Click button → không có visual response
   - Loading data → UI đứng im
   - Errors → không có messages

3. ⚠️ **API có thể chậm**
   - Cold start
   - Không có caching
   - Response time chưa optimize

---

## ✅ SOLUTION

### **Phase 1: Loading States (FE)**

**Components cần tạo:**

1. **Spinner Component**
```tsx
// apps/web/src/components/ui/spinner.tsx
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'default' }) {
  return (
    <Loader2 
      className={cn(
        'animate-spin',
        size === 'sm' && 'h-4 w-4',
        size === 'default' && 'h-6 w-6',
        size === 'lg' && 'h-8 w-8'
      )}
    />
  );
}
```

2. **Skeleton Component**
```tsx
// apps/web/src/components/ui/skeleton.tsx
export function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
  );
}

// Usage
<Skeleton className="h-20 w-full" />
```

3. **Button Loading State**
```tsx
// apps/web/src/components/ui/button.tsx
<button disabled={loading}>
  {loading && <Spinner size="sm" className="mr-2" />}
  {children}
</button>
```

**Pages cần update:**

1. **Worklist (apps/web/src/app/page.tsx)**
```tsx
{loading ? (
  <div className="space-y-4">
    {[1,2,3,4,5].map(i => (
      <Skeleton key={i} className="h-24 w-full" />
    ))}
  </div>
) : (
  <EpisodeList episodes={episodes} />
)}
```

2. **Case Detail (apps/web/src/app/cases/[id]/page.tsx)**
```tsx
{loading ? (
  <div className="space-y-6">
    <Skeleton className="h-64 w-full" /> {/* Image */}
    <Skeleton className="h-40 w-full" /> {/* Findings */}
    <Skeleton className="h-60 w-full" /> {/* Explanation */}
  </div>
) : (
  <CaseContent case={caseData} />
)}
```

3. **Upload Page (apps/web/src/app/cases/new/page.tsx)**
```tsx
<button disabled={uploading}>
  {uploading && <Spinner size="sm" className="mr-2" />}
  {uploading ? 'Đang tải lên...' : 'Tải lên'}
</button>
```

---

### **Phase 2: Error Handling (FE)**

**Toast Component:**
```tsx
// apps/web/src/components/ui/toast.tsx
export function Toast({ message, type, onRetry }) {
  return (
    <div className={cn('toast', type === 'error' && 'bg-red-500')}>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry}>Thử lại</button>
      )}
    </div>
  );
}
```

**API Client Error Handling:**
```tsx
// apps/web/src/lib/api/client.ts
async function apiCall(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - vui lòng thử lại');
    }
    throw error;
  }
}
```

---

### **Phase 3: Backend Optimization (BE1)**

**Timing Middleware:**
```typescript
// apps/api/src/index.ts
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${duration}ms`);
    
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});
```

**Cache Headers:**
```typescript
// apps/api/src/routes/query.ts
res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min cache
```

---

## 📋 TASK BREAKDOWN

### **FE (agentUI) - 1.5 days**

**Day 1 Morning (4h):**
- [ ] Create Spinner component
- [ ] Create Skeleton component
- [ ] Add loading to Worklist page
- [ ] Test Worklist loading states

**Day 1 Afternoon (4h):**
- [ ] Add loading to Case Detail page
- [ ] Add loading to Upload page
- [ ] Add button loading states
- [ ] Test all pages

**Day 2 Morning (2h):**
- [ ] Create Toast component
- [ ] Add error handling to API client
- [ ] Add timeout handling
- [ ] Test error scenarios

**Day 2 Afternoon (2h):**
- [ ] Polish animations
- [ ] Test all edge cases
- [ ] Fix bugs
- [ ] Request review from agentFE

---

### **BE1 (agentBE) - 0.5 day**

**Day 2 Morning (3h):**
- [ ] Add timing middleware
- [ ] Add cache headers to routes
- [ ] Test response times
- [ ] Log slow queries

**Day 2 Afternoon (1h):**
- [ ] Review logs
- [ ] Optimize slow endpoints (if any)
- [ ] Document findings

---

## ✅ SUCCESS CRITERIA

### **User Experience:**
- ✅ Click button → Immediate visual feedback (< 100ms)
- ✅ Loading data → Spinner hoặc skeleton visible
- ✅ Error → Clear message + retry option
- ✅ Slow API → Timeout message sau 30s
- ✅ User luôn biết app đang làm gì

### **Performance:**
- ✅ API response < 2s (95th percentile)
- ✅ Loading states show < 100ms sau click
- ✅ No "frozen" UI
- ✅ Smooth animations (60fps)

### **Code Quality:**
- ✅ Reusable components (Spinner, Skeleton, Toast)
- ✅ Consistent loading patterns across pages
- ✅ Proper error handling
- ✅ TypeScript types

---

## 🧪 TESTING CHECKLIST

### **Manual Testing:**
- [ ] Worklist: Load page → See skeletons → See data
- [ ] Case Detail: Click episode → See loading → See content
- [ ] Upload: Click upload → Button shows loading → Success/Error
- [ ] Slow network: Throttle to 3G → All loading states work
- [ ] Error: Disconnect network → See error message + retry
- [ ] Timeout: Block API → See timeout message after 30s

### **Edge Cases:**
- [ ] Multiple rapid clicks → Only one request
- [ ] Navigate away during loading → Cancel request
- [ ] Error during loading → Show error, hide loading
- [ ] Retry after error → Loading state reappears

---

## 📊 METRICS TO TRACK

**Before Fix:**
- Loading indicator coverage: 0%
- User confusion rate: High
- Bounce rate: Unknown

**After Fix (Target):**
- Loading indicator coverage: 100%
- User confusion rate: Low
- Time to first interaction feedback: < 100ms
- API response time: < 2s (p95)

---

## 🚨 RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| Skeleton layout shift | MEDIUM | Use exact dimensions |
| Too many spinners | LOW | Use sparingly, prefer skeletons |
| Animations janky | MEDIUM | Use CSS transforms only |
| Timeout too short | LOW | 30s is reasonable, can adjust |

---

## 📝 NOTES

**Design Principles:**
- Medical-grade: Subtle, professional
- Timing: 150-300ms transitions
- Feedback: Immediate (< 100ms)
- Errors: Clear, actionable

**Libraries:**
- lucide-react (Loader2 icon)
- Framer Motion (already installed)
- Tailwind CSS (animate-pulse, animate-spin)

---

## 🔗 REFERENCES

- UI Animation Plan: `_docs/technical/UI_ANIMATION_PLAN.md`
- API Client: `apps/web/src/lib/api/client.ts`
- Existing animations: `apps/web/src/app/globals.css`

---

**Status:** 🔴 URGENT - Assigned  
**Next Update:** Daily in chat2.md  
**Review:** agentFE (Kiro) will review when complete
