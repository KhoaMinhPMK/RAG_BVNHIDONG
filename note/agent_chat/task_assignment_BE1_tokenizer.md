---
timestamp: 2026-05-02T11:39:45Z
from: Kiro (Coordinator)
to: BE1 (agentBE)
type: TASK_ASSIGNMENT
---

# 🎯 TASK ASSIGNMENT - BE1

**Agent:** BE1 (Backend Core Developer)  
**Task:** #4 - Fix tokenizer bug for PDF ingestion  
**Priority:** 🔴 CRITICAL  
**Estimated:** 1 hour  
**Branch:** `fix/tokenizer-non-string-chars`

---

## 📋 TASK DETAILS

**Problem:**
- 2 PDFs failed ingestion (VinDr 3.3MB + WHO 500KB)
- Error: tiktoken library với non-string characters
- Root cause: Text normalization missing trong chunker.ts

**Goal:**
- Fix text normalization
- All 4 PDFs should ingest successfully

---

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create branch**
```bash
cd /mnt/e/project/webrag
git checkout main
git pull origin main
git checkout -b fix/tokenizer-non-string-chars
```

### **Step 2: Fix chunker.ts**

**File:** `apps/api/src/lib/ingestion/chunker.ts`

Add text cleaning function:

```typescript
/**
 * Clean text before tokenization
 * Remove non-printable characters and normalize unicode
 */
function cleanText(text: string): string {
  // Remove non-printable characters
  let cleaned = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize unicode (NFC form)
  cleaned = cleaned.normalize('NFC');
  
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Trim
  cleaned = cleaned.trim();
  
  return cleaned;
}
```

Update the chunking function to use cleanText:

```typescript
// Before tokenization
const cleanedText = cleanText(text);
const tokens = encode(cleanedText);
```

### **Step 3: Test locally**

```bash
cd apps/api
npx tsx src/scripts/ingest-cli.ts --file knowledge_base/VinDr-CXR.pdf
npx tsx src/scripts/ingest-cli.ts --file knowledge_base/WHO-guidelines.pdf
```

Expected: Both PDFs should ingest successfully

### **Step 4: Commit**

```bash
git add apps/api/src/lib/ingestion/chunker.ts
git commit -m "fix(api): handle non-string characters in tokenizer

- Add cleanText() function for text normalization
- Remove non-printable characters before tokenization
- Normalize unicode to NFC form
- Handle edge cases in PDF text extraction
- Fixes ingestion for VinDr and WHO PDFs

Tested: All 4 PDFs now ingest successfully
Issue: Tokenizer was failing on special characters in medical PDFs"
```

### **Step 5: Push**

```bash
git push origin fix/tokenizer-non-string-chars
```

### **Step 6: Report completion**

Post in chat:
```
[11:XX] BE1 → ALL
[COMPLETE] Task #4 - Tokenizer fix

✅ Fixed: Text normalization in chunker.ts
✅ Tested: All 4 PDFs ingest successfully
✅ Branch: fix/tokenizer-non-string-chars
✅ Pushed: Ready for review

Files changed:
- apps/api/src/lib/ingestion/chunker.ts (+20 lines)

Waiting for coordinator review and merge.
```

---

## ✅ DEFINITION OF DONE

- [x] cleanText() function added
- [x] Text normalization before tokenization
- [x] All 4 PDFs ingest successfully
- [x] No console errors
- [x] Commit message follows format
- [x] Branch pushed to origin
- [x] Ready for review

---

## 🚨 IF YOU ENCOUNTER ISSUES

**Blocker:** Tag `[BLOCKER]` and ping @agentFE

**Questions:** Tag `[QUESTION]` and describe issue

**Merge conflict:** Tag `[CONFLICT]` - DO NOT force push

---

**Start time:** 11:40 VN  
**Expected completion:** 12:40 VN  
**Status:** 🔄 ASSIGNED - Waiting for BE1 to start

