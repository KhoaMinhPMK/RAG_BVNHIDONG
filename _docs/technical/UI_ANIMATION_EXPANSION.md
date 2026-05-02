---
noteId: "2d6a7110454011f1b3ce19fa7351e6bb"
tags: []

---

# UI Animation Expansion Plan — Apply to ALL Components

**Document Version:** 2.0  
**Date:** 2026-05-01  
**Author:** agentFE  
**Target:** agentUI  

---

## Executive Summary

AgentUI đã implement animations cho **3 components** (fullscreen zoom, modal, login form). User yêu cầu mở rộng animations cho **TẤT CẢ components** trong UI.

**Current coverage:** ~15% (3/20 components)  
**Target coverage:** 100% (20/20 components)

---

## Component Inventory & Animation Status

### ✅ Đã có animations (3/20)

1. **Fullscreen Image** (`cases/[id]/page.tsx`)
   - ✅ Fade + scale animation
   - ✅ Background blur

2. **Modal** (`components/ui/modal.tsx`)
   - ✅ Fade + scale
   - ✅ Backdrop animation

3. **Login Form** (`app/login/page.tsx`)
   - ✅ Error shake
   - ✅ Focus ring

---

### ❌ Chưa có animations (17/20)

#### **Layout Components (4)**

4. **Header** (`components/ui/header.tsx`)
   - ❌ User dropdown: xuất hiện đột ngột
   - ❌ Status dots: không có pulse
   - ❌ Language selector: không có transition

5. **Sidebar** (`components/ui/sidebar.tsx`)
   - ✅ Collapse animation có rồi (duration-200)
   - ❌ Nav items: không có hover lift
   - ❌ Active state: không có smooth transition
   - ❌ System status: không có pulse

6. **Context Bar** (`components/ui/context-bar.tsx`)
   - ❌ Chưa đọc, cần check

7. **App Layout** (`components/ui/app-layout.tsx`)
   - ❌ Page mount: không có fade in

---

#### **Page Components (6)**

8. **Worklist** (`app/page.tsx`)
   - ❌ Episode cards: xuất hiện cùng lúc (cần stagger)
   - ❌ Hover: không có lift effect
   - ❌ Status spinner: không có fade in
   - ❌ Refresh countdown: không có animation

9. **Case Detail** (`app/cases/[id]/page.tsx`)
   - ✅ Fullscreen có rồi
   - ❌ Step tabs: không có active indicator slide
   - ❌ Detection findings: không có stagger
   - ❌ Explanation text: không có fade in
   - ❌ Draft fields: không có focus animation
   - ❌ Chat messages: không có slide up
   - ❌ Citation buttons: không có hover scale

10. **Upload Form** (`app/cases/new/page.tsx`)
    - ❌ File drop zone: không có hover scale
    - ❌ File list: không có stagger
    - ❌ Upload progress: không có smooth bar
    - ❌ Success checkmark: không có scale animation

11. **Knowledge Page** (`app/knowledge/page.tsx`)
    - ❌ Chưa đọc, cần check

12. **Admin Page** (`app/admin/page.tsx`)
    - ❌ Chưa đọc, cần check

13. **Login Page** (`app/login/page.tsx`)
    - ✅ Error shake có rồi
    - ✅ Focus ring có rồi
    - ❌ Submit button: không có loading spinner
    - ❌ Success redirect: không có fade out

---

#### **Micro-interactions (7)**

14. **Buttons** (all pages)
    - ❌ Primary buttons: không có press effect
    - ❌ Icon buttons: không có scale on hover
    - ❌ Loading state: không có spinner fade

15. **Links** (all pages)
    - ❌ Nav links: không có underline slide
    - ❌ Card links: không có lift effect

16. **Badges/Tags** (worklist, case detail)
    - ❌ Status badges: không có pulse
    - ❌ Finding tags: không có hover scale

17. **Tooltips** (future)
    - ❌ Chưa có component

18. **Notifications/Toasts** (future)
    - ❌ Chưa có component

19. **Loading Skeletons** (all pages)
    - ❌ Không có shimmer effect
    - ❌ Xuất hiện đột ngột

20. **Scroll Animations** (long pages)
    - ❌ Không có fade in on scroll

---

## Detailed Animation Plan by Component

### 🎯 Priority 1: Layout Components (HIGH)

#### Task 1.1: Header User Dropdown
**File:** `components/ui/header.tsx`

**Current:**
```tsx
{isOpen && (
  <div className="absolute right-0 top-full mt-1 ...">
    {/* Menu items */}
  </div>
)}
```

**Add animations:**
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 top-full mt-1 ..."
    >
      {/* Menu items with stagger */}
      <motion.div variants={menuItemVariants}>
        {/* Items */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**Also add:**
- ChevronDown rotate animation (đã có `transition-transform`)
- Avatar skeleton pulse khi loading
- Status dots pulse animation

---

#### Task 1.2: Sidebar Nav Items
**File:** `components/ui/sidebar.tsx`

**Add animations:**
```tsx
<Link
  href={item.href}
  className={`... hover-lift transition-all duration-150`}
>
  {/* Icon scale on hover */}
  <Icon className="... transition-transform group-hover:scale-110" />
</Link>
```

**Also add:**
- Active indicator slide animation
- Nav items stagger on mount
- System status pulse

---

#### Task 1.3: Context Bar
**File:** `components/ui/context-bar.tsx`

**Need to read first, then add:**
- Slide down animation on mount
- Smooth transitions

---

#### Task 1.4: App Layout Page Mount
**File:** `components/ui/app-layout.tsx`

**Add:**
```tsx
<motion.main
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>
  {children}
</motion.main>
```

---

### 🎯 Priority 2: Worklist Page (HIGH)

#### Task 2.1: Episode Cards Stagger
**File:** `app/page.tsx`

**Current:**
```tsx
{episodes.map((ep) => (
  <Link key={ep.id} href={`/cases/${ep.id}`}>
    {/* Card content */}
  </Link>
))}
```

**Add stagger:**
```tsx
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="show"
>
  {episodes.map((ep, index) => (
    <motion.div
      key={ep.id}
      variants={itemVariants}
      custom={index}
    >
      <Link href={`/cases/${ep.id}`} className="hover-lift">
        {/* Card content */}
      </Link>
    </motion.div>
  ))}
</motion.div>

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};
```

**Also add:**
- Hover lift effect (đã có class `.hover-lift` trong globals.css)
- Status spinner fade in with delay
- Refresh countdown smooth number transition

---

### 🎯 Priority 3: Case Detail Page (HIGH)

#### Task 3.1: Step Tabs Active Indicator
**File:** `app/cases/[id]/page.tsx`

**Add sliding underline:**
```tsx
<div className="relative">
  {steps.map((step) => (
    <button key={step} className="...">
      {step}
    </button>
  ))}
  
  {/* Sliding indicator */}
  <motion.div
    layoutId="activeTab"
    className="absolute bottom-0 h-0.5 bg-brand-primary"
    transition={{ duration: 0.2, ease: 'easeOut' }}
  />
</div>
```

---

#### Task 3.2: Detection Findings Stagger
**File:** `app/cases/[id]/page.tsx`

**Add stagger animation cho findings list:**
```tsx
<motion.div variants={containerVariants} initial="hidden" animate="show">
  {findings.map((finding, i) => (
    <motion.div key={i} variants={itemVariants}>
      {/* Finding item */}
    </motion.div>
  ))}
</motion.div>
```

---

#### Task 3.3: Explanation Text Fade In
**File:** `app/cases/[id]/page.tsx`

**Add fade in cho streaming text:**
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {explanationText}
</motion.div>
```

---

#### Task 3.4: Chat Messages Slide Up
**File:** `app/cases/[id]/page.tsx`

**Add slide up animation:**
```tsx
<AnimatePresence>
  {messages.map((msg, i) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {msg.content}
    </motion.div>
  ))}
</AnimatePresence>
```

---

#### Task 3.5: Citation Buttons Hover Scale
**File:** `app/cases/[id]/page.tsx`

**Add:**
```tsx
<button className="... transition-transform hover:scale-110">
  {citationNumber}
</button>
```

---

### 🎯 Priority 4: Upload Form (MEDIUM)

#### Task 4.1: File Drop Zone
**File:** `app/cases/new/page.tsx`

**Add:**
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className="border-2 border-dashed ..."
>
  {/* Drop zone content */}
</motion.div>
```

---

#### Task 4.2: File List Stagger
**File:** `app/cases/new/page.tsx`

**Add stagger cho uploaded files:**
```tsx
<AnimatePresence>
  {files.map((file, i) => (
    <motion.div
      key={file.name}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2, delay: i * 0.05 }}
    >
      {/* File item */}
    </motion.div>
  ))}
</AnimatePresence>
```

---

#### Task 4.3: Upload Progress Bar
**File:** `app/cases/new/page.tsx`

**Add smooth progress:**
```tsx
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
  className="h-1 bg-brand-primary"
/>
```

---

#### Task 4.4: Success Checkmark
**File:** `app/cases/new/page.tsx`

**Add scale animation:**
```tsx
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
>
  <CheckCircle className="w-6 h-6 text-semantic-success" />
</motion.div>
```

---

### 🎯 Priority 5: Micro-interactions (MEDIUM)

#### Task 5.1: Button Press Effect
**Add to globals.css:**
```css
.btn-press {
  transition: transform 100ms ease-out;
}

.btn-press:active {
  transform: scale(0.97);
}
```

**Apply to all buttons:**
```tsx
<button className="... btn-press">
  {/* Button content */}
</button>
```

---

#### Task 5.2: Icon Button Scale
**Add:**
```tsx
<button className="... transition-transform hover:scale-110 active:scale-95">
  <Icon />
</button>
```

---

#### Task 5.3: Status Badge Pulse
**Add to globals.css:**
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-pulse {
  animation: pulse-dot 2s ease-in-out infinite;
}
```

**Apply:**
```tsx
<span className="w-1.5 h-1.5 rounded-full bg-semantic-success status-pulse" />
```

---

#### Task 5.4: Loading Skeleton Shimmer
**Already have in globals.css, just need to apply:**
```tsx
<div className="skeleton h-4 w-32" />
```

---

### 🎯 Priority 6: Advanced (LOW)

#### Task 6.1: Scroll Fade In
**Add Intersection Observer:**
```tsx
const FadeInOnScroll = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};
```

---

#### Task 6.2: Page Transitions
**Add to all pages:**
```tsx
<PageTransition>
  {/* Page content */}
</PageTransition>
```

---

## Implementation Checklist

### Phase 1: Layout (1 day)
- [ ] Header user dropdown fade + scale
- [ ] Header status dots pulse
- [ ] Sidebar nav items hover lift
- [ ] Sidebar active indicator
- [ ] Context bar slide down
- [ ] App layout page fade in

### Phase 2: Worklist (0.5 day)
- [ ] Episode cards stagger
- [ ] Card hover lift
- [ ] Status spinner fade in
- [ ] Refresh countdown transition

### Phase 3: Case Detail (1 day)
- [ ] Step tabs sliding indicator
- [ ] Detection findings stagger
- [ ] Explanation text fade in
- [ ] Chat messages slide up
- [ ] Citation buttons hover scale
- [ ] Draft fields focus animation

### Phase 4: Upload Form (0.5 day)
- [ ] Drop zone hover scale
- [ ] File list stagger
- [ ] Progress bar smooth
- [ ] Success checkmark scale

### Phase 5: Micro-interactions (0.5 day)
- [ ] Button press effect (all buttons)
- [ ] Icon button scale (all icon buttons)
- [ ] Status badge pulse
- [ ] Loading skeleton shimmer
- [ ] Link hover effects

### Phase 6: Advanced (0.5 day)
- [ ] Scroll fade in (long pages)
- [ ] Page transitions (all routes)
- [ ] Tooltip animations (if needed)

---

## Global CSS Additions Needed

```css
/* apps/web/src/styles/globals.css */

/* Button press effect */
.btn-press {
  transition: transform 100ms ease-out;
}
.btn-press:active {
  transform: scale(0.97);
}

/* Status pulse */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.status-pulse {
  animation: pulse-dot 2s ease-in-out infinite;
}

/* Slide underline (for tabs) */
@keyframes slide-underline {
  from { transform: translateX(var(--from)); }
  to { transform: translateX(var(--to)); }
}

/* Number transition */
.number-transition {
  transition: all 300ms ease-out;
}
```

---

## Files to Modify

### High Priority (8 files)
1. `components/ui/header.tsx` — dropdown, status pulse
2. `components/ui/sidebar.tsx` — nav hover, active indicator
3. `components/ui/context-bar.tsx` — slide down
4. `components/ui/app-layout.tsx` — page fade
5. `app/page.tsx` — cards stagger, hover lift
6. `app/cases/[id]/page.tsx` — tabs, findings, chat, citations
7. `app/cases/new/page.tsx` — drop zone, file list, progress
8. `styles/globals.css` — new utilities

### Medium Priority (2 files)
9. `app/knowledge/page.tsx` — check & add animations
10. `app/admin/page.tsx` — check & add animations

### Low Priority (1 file)
11. All pages — wrap với PageTransition

---

## Estimated Effort

- **Phase 1 (Layout)**: 1 day
- **Phase 2 (Worklist)**: 0.5 day
- **Phase 3 (Case Detail)**: 1 day
- **Phase 4 (Upload)**: 0.5 day
- **Phase 5 (Micro)**: 0.5 day
- **Phase 6 (Advanced)**: 0.5 day
- **Total**: 4 days

---

## Success Criteria

### Must Have
- ✅ 100% components có animations
- ✅ Consistent timing (100-400ms)
- ✅ Medical-grade (subtle, smooth)
- ✅ 60fps, no jank
- ✅ No "bụp" instant appearances

### Nice to Have
- ✅ Scroll animations
- ✅ Page transitions
- ✅ Advanced micro-interactions

---

**END OF EXPANSION PLAN**
