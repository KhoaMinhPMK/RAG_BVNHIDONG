---
noteId: "4caa0b10453d11f1b3ce19fa7351e6bb"
tags: []

---

# UI Animation & Transitions System — Implementation Plan

**Document Version:** 1.0  
**Date:** 2026-05-01  
**Author:** agentFE  
**Target:** agentUI  

---

## Executive Summary

Hiện tại UI đã có một số transitions cơ bản (sidebar collapse, hover states) nhưng chưa có hệ thống animation nhất quán. User yêu cầu áp dụng animations mượt mà cho toàn bộ UI, đặc biệt là:

- **Fullscreen image zoom** — thay vì "bụp" tức thì, cần smooth scale + fade
- **Page transitions** — khi navigate giữa các routes
- **Modal/Dialog** — fade in/out + scale
- **List items** — stagger animation khi load
- **Form interactions** — smooth focus states, error shake
- **Loading states** — skeleton shimmer, spinner fade

**Mục tiêu:** Tạo một animation system nhất quán, performant, medical-grade (không quá fancy, vừa đủ mượt).

---

## Current State Analysis

### ✅ Đã có animations

1. **Sidebar collapse** (`sidebar.tsx` line 52):
   ```tsx
   className={`... transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}
   ```
   - Duration: 200ms
   - Property: width
   - ✅ Mượt, không có vấn đề

2. **Hover states** (nhiều components):
   ```tsx
   className="... hover:bg-background-secondary transition-colors"
   ```
   - Default transition (150ms)
   - Property: colors
   - ✅ OK nhưng thiếu duration explicit

3. **Button hover** (citation buttons, nav items):
   ```tsx
   className="... hover:bg-brand-primary hover:text-white transition-colors"
   ```
   - ✅ Có transition nhưng không consistent

### ❌ Chưa có animations

1. **Fullscreen image** — hiện tại "bụp" tức thì
2. **Page transitions** — hard cut giữa routes
3. **Modal/Dialog** — xuất hiện đột ngột
4. **List loading** — items xuất hiện cùng lúc
5. **Form errors** — text xuất hiện đột ngột
6. **Loading spinners** — không có fade in/out
7. **Step transitions** (detection → explain → draft) — hard switch

---

## Animation Principles (Medical-Grade)

### 🎯 Design Philosophy

**Medical software ≠ Consumer app**
- ❌ Không dùng: bouncy, elastic, overshoot effects
- ❌ Không dùng: quá nhiều parallax, 3D transforms
- ❌ Không dùng: animations quá dài (> 400ms)
- ✅ Dùng: subtle, smooth, purposeful
- ✅ Dùng: easing curves tự nhiên (ease-out, ease-in-out)
- ✅ Dùng: consistent timing (150ms, 200ms, 300ms)

### ⏱️ Timing Scale

| Duration | Use Case | Example |
|----------|----------|---------|
| **100ms** | Micro-interactions | Hover, focus, active states |
| **150ms** | Quick transitions | Color changes, opacity |
| **200ms** | Standard transitions | Width, height, transform (small) |
| **300ms** | Medium transitions | Modal fade, panel slide |
| **400ms** | Slow transitions | Fullscreen, page transitions |

### 🎨 Easing Functions

```css
/* Tailwind v4 built-in easings */
ease-linear    /* Linear — rarely use */
ease-in        /* Slow start — use for exit animations */
ease-out       /* Slow end — use for enter animations */
ease-in-out    /* Slow both — use for reversible animations */
```

**Recommended:**
- **Enter animations**: `ease-out` (fast start, slow end)
- **Exit animations**: `ease-in` (slow start, fast end)
- **Reversible**: `ease-in-out` (smooth both ways)

---

## Implementation Strategy

### Option A: Tailwind Utilities (Recommended)

**Pros:**
- ✅ No extra dependencies
- ✅ Consistent với design system
- ✅ Easy to maintain
- ✅ Good performance (CSS transitions)

**Cons:**
- ❌ Limited control (no complex sequences)
- ❌ No JavaScript hooks

**Decision:** Use Tailwind for 90% of animations, Framer Motion for complex cases only.

---

### Option B: Framer Motion (For Complex Cases)

**Pros:**
- ✅ Powerful API
- ✅ Layout animations
- ✅ Gesture support
- ✅ Stagger, sequence, orchestration

**Cons:**
- ❌ Bundle size (~30KB gzipped)
- ❌ Learning curve
- ❌ Overkill cho simple transitions

**Decision:** Use only for:
- Fullscreen image zoom (layout animation)
- Page transitions (AnimatePresence)
- Complex stagger effects

---

## Animation Catalog

### 1. Fullscreen Image Zoom (Priority: HIGH)

**Current behavior:**
```tsx
// apps/web/src/app/cases/[id]/page.tsx
<button onClick={() => setFullscreen(true)}>
  <Maximize2 />
</button>

{fullscreen && (
  <div className="fixed inset-0 z-50 bg-zinc-950">
    <img src={sample.imgSrc} /> {/* Appears instantly */}
  </div>
)}
```

**Desired behavior:**
1. Click Maximize → image scales from current position to fullscreen
2. Background fades in (black overlay)
3. Image zooms smoothly with ease-out
4. Press Esc → reverse animation

**Solution: Framer Motion**

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {fullscreen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 bg-zinc-950"
    >
      <motion.img
        layoutId="xray-image" // Magic: shared layout animation
        src={sample.imgSrc}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </motion.div>
  )}
</AnimatePresence>
```

**Files to modify:**
- `apps/web/src/app/cases/[id]/page.tsx`
- Add `layoutId="xray-image"` to thumbnail image
- Wrap fullscreen with AnimatePresence

---

### 2. Page Transitions (Priority: MEDIUM)

**Current behavior:**
- Hard cut giữa routes (/, /cases/new, /cases/[id])

**Desired behavior:**
- Fade out old page (150ms)
- Fade in new page (200ms)
- Total: 350ms

**Solution: Framer Motion + Next.js App Router**

```tsx
// apps/web/src/components/ui/page-transition.tsx (NEW)
'use client';

import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

**Usage:**
```tsx
// apps/web/src/app/page.tsx
export default function WorklistPage() {
  return (
    <PageTransition>
      {/* existing content */}
    </PageTransition>
  );
}
```

**Files to modify:**
- Create `apps/web/src/components/ui/page-transition.tsx`
- Wrap all page components: `page.tsx`, `cases/new/page.tsx`, `cases/[id]/page.tsx`

---

### 3. Modal/Dialog Animations (Priority: HIGH)

**Current behavior:**
- Citation popup xuất hiện đột ngột
- Logout confirmation (future) sẽ cần modal

**Desired behavior:**
- Background overlay fades in (150ms)
- Modal scales from 0.95 → 1.0 + fades in (200ms)
- Exit: reverse

**Solution: Tailwind + Framer Motion**

```tsx
// apps/web/src/components/ui/modal.tsx (NEW)
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-surface rounded-lg shadow-xl max-w-lg w-full p-6">
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                  <button
                    onClick={onClose}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Content */}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Files to create:**
- `apps/web/src/components/ui/modal.tsx`

**Files to modify:**
- `apps/web/src/app/cases/[id]/page.tsx` — replace citation popup với Modal component

---

### 4. List Stagger Animation (Priority: MEDIUM)

**Current behavior:**
- Worklist items xuất hiện cùng lúc

**Desired behavior:**
- Items fade in + slide up, staggered by 50ms

**Solution: Framer Motion**

```tsx
// apps/web/src/app/page.tsx
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // 50ms delay between items
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

<motion.div variants={container} initial="hidden" animate="show">
  {episodes.map((ep) => (
    <motion.div key={ep.id} variants={item}>
      <Link href={`/cases/${ep.id}`}>
        {/* existing content */}
      </Link>
    </motion.div>
  ))}
</motion.div>
```

**Files to modify:**
- `apps/web/src/app/page.tsx` — worklist items

---

### 5. Form Interactions (Priority: MEDIUM)

**Current behavior:**
- Focus states: instant
- Error messages: instant

**Desired behavior:**
- Focus ring: smooth scale (100ms)
- Error shake: subtle shake animation
- Success checkmark: scale + fade

**Solution: Tailwind + Custom CSS**

```css
/* apps/web/src/styles/globals.css */

/* Focus ring animation */
@keyframes focus-ring {
  0% { box-shadow: 0 0 0 0 hsl(217 91% 60% / 0); }
  100% { box-shadow: 0 0 0 3px hsl(217 91% 60% / 0.2); }
}

.focus-ring {
  @apply outline-none;
  transition: box-shadow 100ms ease-out;
}

.focus-ring:focus {
  animation: focus-ring 100ms ease-out forwards;
}

/* Error shake */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.error-shake {
  animation: shake 300ms ease-in-out;
}

/* Success checkmark */
@keyframes check-scale {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.success-check {
  animation: check-scale 300ms ease-out;
}
```

**Usage:**
```tsx
<input
  className="focus-ring border border-border rounded-sm px-3 py-2"
  {...register('email')}
/>

{errors.email && (
  <p className="error-shake text-xs text-semantic-error mt-1">
    {errors.email.message}
  </p>
)}
```

**Files to modify:**
- `apps/web/src/styles/globals.css` — add keyframes
- `apps/web/src/app/login/page.tsx` — apply to form inputs

---

### 6. Loading States (Priority: MEDIUM)

**Current behavior:**
- Spinner xuất hiện đột ngột
- Skeleton không có shimmer effect

**Desired behavior:**
- Spinner fades in after 300ms delay (avoid flash)
- Skeleton has shimmer animation

**Solution: Tailwind + CSS**

```css
/* apps/web/src/styles/globals.css */

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  @apply bg-background-tertiary rounded-sm;
  background-image: linear-gradient(
    90deg,
    hsl(210 14% 92%) 0%,
    hsl(210 16% 95%) 50%,
    hsl(210 14% 92%) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Delayed fade-in for spinners */
.spinner-delayed {
  opacity: 0;
  animation: fade-in 150ms ease-out 300ms forwards;
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

**Usage:**
```tsx
// Skeleton
<div className="skeleton h-4 w-32" />

// Spinner with delay
<Loader2 className="spinner-delayed w-4 h-4 animate-spin" />
```

**Files to modify:**
- `apps/web/src/styles/globals.css` — add animations
- `apps/web/src/app/page.tsx` — apply to loading states

---

### 7. Step Transitions (Priority: LOW)

**Current behavior:**
- Detection → Explain → Draft: hard switch

**Desired behavior:**
- Content fades out (150ms)
- Content fades in (200ms)
- Panel width animates smoothly (200ms)

**Solution: Framer Motion**

```tsx
// apps/web/src/app/cases/[id]/page.tsx
<AnimatePresence mode="wait">
  <motion.div
    key={step} // Re-mount on step change
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -10 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    {step === 'detection' && <DetectionContent />}
    {step === 'explain' && <ExplainContent />}
    {step === 'draft' && <DraftContent />}
  </motion.div>
</AnimatePresence>
```

**Files to modify:**
- `apps/web/src/app/cases/[id]/page.tsx` — wrap step content

---

## Global Animation Utilities

### Create Reusable Classes

```css
/* apps/web/src/styles/globals.css */

/* Transition utilities */
.transition-smooth {
  transition: all 200ms ease-out;
}

.transition-fast {
  transition: all 150ms ease-out;
}

.transition-slow {
  transition: all 300ms ease-out;
}

/* Hover lift */
.hover-lift {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px hsl(220 13% 82% / 0.3);
}

/* Fade in */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}

/* Slide up */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-up {
  animation: slide-up 200ms ease-out;
}
```

---

## Implementation Plan

### Phase 1: Foundation (Priority: HIGH)

**Task 1.1: Install Framer Motion**
```bash
cd apps/web
npm install framer-motion
```

**Task 1.2: Add Global Animation Utilities**
- File: `apps/web/src/styles/globals.css`
- Add: keyframes, transition utilities, skeleton shimmer

**Task 1.3: Create Reusable Components**
- File: `apps/web/src/components/ui/modal.tsx` (NEW)
- File: `apps/web/src/components/ui/page-transition.tsx` (NEW)

**Dấu hiệu hoàn thành:**
- ✅ Framer Motion installed
- ✅ Global CSS utilities added
- ✅ Modal + PageTransition components created

---

### Phase 2: High-Priority Animations (Priority: HIGH)

**Task 2.1: Fullscreen Image Zoom**
- File: `apps/web/src/app/cases/[id]/page.tsx`
- Add: AnimatePresence, layoutId, smooth zoom

**Task 2.2: Modal Animations**
- File: `apps/web/src/app/cases/[id]/page.tsx`
- Replace: citation popup với Modal component

**Task 2.3: Form Interactions**
- File: `apps/web/src/app/login/page.tsx`
- Add: focus-ring, error-shake classes

**Dấu hiệu hoàn thành:**
- ✅ Fullscreen zoom mượt mà
- ✅ Citation popup có fade + scale
- ✅ Login form có focus ring + error shake

---

### Phase 3: Medium-Priority Animations (Priority: MEDIUM)

**Task 3.1: Page Transitions**
- Files: `apps/web/src/app/page.tsx`, `cases/new/page.tsx`, `cases/[id]/page.tsx`
- Wrap: với PageTransition component

**Task 3.2: List Stagger**
- File: `apps/web/src/app/page.tsx`
- Add: stagger animation cho worklist items

**Task 3.3: Loading States**
- Files: `apps/web/src/app/page.tsx`, `cases/[id]/page.tsx`
- Add: skeleton shimmer, spinner-delayed

**Dấu hiệu hoàn thành:**
- ✅ Page transitions mượt
- ✅ Worklist items stagger
- ✅ Skeleton có shimmer effect

---

### Phase 4: Low-Priority Animations (Priority: LOW)

**Task 4.1: Step Transitions**
- File: `apps/web/src/app/cases/[id]/page.tsx`
- Add: AnimatePresence cho step content

**Task 4.2: Hover Effects**
- Files: All components
- Add: hover-lift cho cards, buttons

**Task 4.3: Polish**
- Review all transitions
- Adjust timings, easings
- Test performance

**Dấu hiệu hoàn thành:**
- ✅ Step transitions mượt
- ✅ Hover effects consistent
- ✅ No jank, 60fps

---

## Performance Considerations

### ✅ Do's

1. **Use CSS transitions** for simple properties (color, opacity, transform)
2. **Use transform + opacity** — GPU-accelerated
3. **Avoid animating** width, height, top, left — causes reflow
4. **Use will-change** sparingly:
   ```css
   .fullscreen-image {
     will-change: transform, opacity;
   }
   ```
5. **Debounce** expensive animations (scroll, resize)

### ❌ Don'ts

1. **Don't animate** box-shadow directly — use opacity on pseudo-element
2. **Don't animate** many elements at once (> 50)
3. **Don't use** long durations (> 400ms) for frequent interactions
4. **Don't nest** too many AnimatePresence (max 2-3 levels)

---

## Testing Checklist

### Manual Testing
- [ ] Fullscreen zoom: smooth, no jank
- [ ] Modal open/close: smooth fade + scale
- [ ] Page transitions: no flash, smooth fade
- [ ] List stagger: items appear sequentially
- [ ] Form focus: smooth ring animation
- [ ] Form error: shake animation
- [ ] Skeleton: shimmer effect visible
- [ ] Spinner: delayed fade-in (300ms)
- [ ] Hover effects: consistent across UI
- [ ] Step transitions: smooth content swap

### Performance Testing
- [ ] Chrome DevTools Performance tab: 60fps
- [ ] No layout thrashing (check Rendering tab)
- [ ] No memory leaks (check Memory tab)
- [ ] Mobile: smooth on low-end devices

---

## Files Summary

### New Files (2)
1. `apps/web/src/components/ui/modal.tsx`
2. `apps/web/src/components/ui/page-transition.tsx`

### Modified Files (6)
1. `apps/web/src/styles/globals.css` — add keyframes, utilities
2. `apps/web/src/app/cases/[id]/page.tsx` — fullscreen zoom, modal, step transitions
3. `apps/web/src/app/page.tsx` — page transition, list stagger, loading states
4. `apps/web/src/app/login/page.tsx` — form interactions
5. `apps/web/src/app/cases/new/page.tsx` — page transition
6. `apps/web/package.json` — add framer-motion

### Dependencies
```bash
npm install framer-motion
```

---

## Estimated Effort

- **Phase 1 (Foundation)**: 0.5 day
- **Phase 2 (High Priority)**: 1 day
- **Phase 3 (Medium Priority)**: 1 day
- **Phase 4 (Low Priority)**: 0.5 day
- **Total**: 3 days

---

## Success Criteria

### Must Have (MVP)
- ✅ Fullscreen image zoom mượt mà
- ✅ Modal animations (fade + scale)
- ✅ Form focus ring + error shake
- ✅ Skeleton shimmer effect
- ✅ Consistent hover states
- ✅ 60fps, no jank

### Nice to Have
- ✅ Page transitions
- ✅ List stagger
- ✅ Step transitions
- ✅ Hover lift effects

---

**END OF PLAN**
