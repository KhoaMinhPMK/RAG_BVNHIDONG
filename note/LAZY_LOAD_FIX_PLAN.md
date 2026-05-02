---
noteId: "lazy-load-fix-plan-20260502"
tags: ["performance", "lazy-loading", "ux", "urgent"]
created: 2026-05-02T08:45:00Z
priority: CRITICAL
assignee: FE (agentUI)
---

# 🚀 KẾ HOẠCH FIX LAZY LOAD & PERFORMANCE

**Vấn đề:** Bấm vào tab rất lâu mới chuyển, không có loading indicator  
**Ưu tiên:** 🔴 CRITICAL  
**Assignee:** FE (agentUI)  
**Estimated:** 1-2 giờ

---

## 🔍 ROOT CAUSES

1. **Không có route transition loading**
   - Click → Không có visual feedback
   - User nghĩ app bị đơ

2. **Components không được lazy load**
   - Tất cả load cùng lúc → Bundle lớn
   - Initial render chậm

3. **API calls blocking**
   - Fetch data trước khi render
   - Không có optimistic UI

4. **No suspense boundaries**
   - Không có fallback khi component đang load

---

## ✅ GIẢI PHÁP

### **PHASE 1: Route Loading Indicators (URGENT - 30 phút)**

**1. Thêm Loading Bar/Spinner cho Route Transitions**

```tsx
// apps/web/src/components/ui/route-loader.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function RouteLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 h-0.5 animate-pulse" />
  );
}

// Hoặc top loading bar:
<div className="fixed top-0 left-0 right-0 z-50">
  <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-loading-bar" />
</div>
```

**2. Thêm Suspense Boundaries**

```tsx
// apps/web/src/app/layout.tsx
import { Suspense } from 'react';
import { RouteLoader } from '@/components/ui/route-loader';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <RouteLoader />
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
```

**3. Loading States cho từng Route**

```tsx
// apps/web/src/app/cases/[id]/page.tsx
import { Suspense } from 'react';
import { CaseDetailSkeleton } from '@/components/ui/loading-skeleton';

export default function CaseDetailPage() {
  return (
    <Suspense fallback={<CaseDetailSkeleton />}>
      <CaseDetailContent />
    </Suspense>
  );
}
```

---

### **PHASE 2: Dynamic Imports & Code Splitting (1 giờ)**

**1. Lazy Load Heavy Components**

```tsx
// apps/web/src/app/page.tsx
import dynamic from 'next/dynamic';

// Lazy load components không cần thiết ngay
const EpisodeList = dynamic(() => import('@/components/episode-list'), {
  loading: () => <EpisodeListSkeleton />,
  ssr: false, // Nếu không cần SSR
});

const DetectionPanel = dynamic(() => import('@/components/detection-panel'), {
  loading: () => <DetectionSkeleton />,
  ssr: true,
});

// Chart components - lazy load vì nặng
const ChartComponent = dynamic(() => import('@/components/chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

**2. Split Routes**

```tsx
// apps/web/src/app/layout.tsx
import dynamic from 'next/dynamic';

// Chỉ load khi cần
const AdminPanel = dynamic(() => import('@/components/admin-panel'), {
  loading: () => <AdminSkeleton />,
});

const KnowledgeBase = dynamic(() => import('@/components/knowledge-base'), {
  loading: () => <KnowledgeSkeleton />,
});
```

**3. Optimize Framer Motion**

```tsx
// Chỉ import khi cần
import dynamic from 'next/dynamic';

const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  { ssr: false, loading: () => <div>Loading animation...</div> }
);
```

---

### **PHASE 3: Optimistic UI & API Optimization (30 phút)**

**1. Optimistic Updates**

```tsx
// apps/web/src/lib/api/client.ts
async function apiCallWithOptimistic(url, options, optimisticData) {
  // Show optimistic data ngay
  updateUI(optimisticData);
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    updateUI(data); // Update với real data
    return data;
  } catch (error) {
    rollbackUI(optimisticData); // Rollback nếu lỗi
    throw error;
  }
}
```

**2. Prefetch Data**

```tsx
// apps/web/src/app/page.tsx
import { prefetch } from '@/lib/api/client';

// Prefetch data khi hover vào link
function EpisodeCard({ episode }) {
  return (
    <div
      onMouseEnter={() => prefetch(`/api/episodes/${episode.id}`)}
    >
      {episode.title}
    </div>
  );
}
```

**3. API Response Caching**

```tsx
// apps/web/src/lib/api/cache.ts
const apiCache = new Map();

async function cachedFetch(url, options, ttl = 30000) {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  apiCache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **PHASE 1: Route Loading (30 phút)**
- [ ] Create RouteLoader component
- [ ] Add to layout.tsx
- [ ] Add Suspense boundaries
- [ ] Test route transitions
- [ ] Verify loading indicators appear

### **PHASE 2: Dynamic Imports (1 giờ)**
- [ ] Lazy load heavy components
- [ ] Split routes
- [ ] Optimize Framer Motion
- [ ] Test initial load time
- [ ] Verify bundle size giảm

### **PHASE 3: Optimistic UI (30 phút)**
- [ ] Add optimistic updates
- [ ] Implement prefetching
- [ ] Add API caching
- [ ] Test perceived performance

---

## 🎯 SUCCESS CRITERIA

### **Performance:**
- ✅ Route transition < 300ms
- ✅ Loading indicator xuất hiện < 100ms
- ✅ Initial bundle < 200KB (gzipped)
- ✅ Lighthouse performance > 80

### **UX:**
- ✅ User luôn thấy feedback khi click
- ✅ Không còn "đứng im" khi chuyển trang
- ✅ Smooth transitions
- ✅ No jank hoặc layout shift

### **Technical:**
- ✅ Code splitting hoạt động
- ✅ Dynamic imports đúng cách
- ✅ Suspense boundaries hợp lý
- ✅ Cache strategy hiệu quả

---

## 📊 METRICS TO TRACK

**Before:**
- Route transition: > 2s (no loading indicator)
- Initial bundle: ~500KB
- Lighthouse: ~50

**After (Target):**
- Route transition: < 300ms
- Initial bundle: < 200KB
- Lighthouse: > 80

---

## 🚨 RISKS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dynamic imports break SSR | HIGH | Test ssr: false components |
| Loading states too complex | MEDIUM | Keep it simple, consistent |
| Cache staleness | LOW | TTL + invalidation |
| Bundle size increase | MEDIUM | Monitor with webpack-bundle-analyzer |

---

## 📝 NOTES

**Priority Order:**
1. RouteLoader component (URGENT - làm ngay)
2. Suspense boundaries (URGENT - làm ngay)
3. Dynamic imports (HIGH - làm trong 1h)
4. Optimistic UI (MEDIUM - làm sau)

**Libraries:**
- Next.js dynamic import
- React Suspense
- lucide-react Loader2
- Framer Motion (đã cài)

**Testing:**
- Lighthouse audit
- Webpack bundle analyzer
- React DevTools profiler

---

**Status:** 🔴 URGENT - Bắt đầu ngay  
**Assignee:** FE (agentUI)  
**Coordinator:** Kiro (agentFE)  
**ETA:** 1-2 giờ
