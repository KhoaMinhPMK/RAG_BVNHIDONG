#!/usr/bin/env python3
# Hook: subagentStart (đổi tên file giữ hooks.json)
# Event: subagentStart
# Mục đích: (1) Luôn inject tiêu chuẩn chất lượng WebRAG cho mọi subagent.
# (2) Nếu task liên quan testing → thêm context Vitest/RTL/patterns dự án.

import sys
import json
import re

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

UNIVERSAL_SUBAGENT_CONTEXT = """## Subagent — Tiêu chuẩn WebRAG (luôn áp dụng)

Bạn là subagent trong monorepo **WebRAG y tế nhi**. Áp dụng **mọi** task:

1. **Đọc trước, sửa sau** — tìm pattern/file hiện có trước khi thêm abstraction mới.
2. **Chuẩn kỹ thuật** — validate bằng Zod từ `@webrag/shared`; RBAC qua `requirePermission()`; không hardcode role trong handler; audit các thao tác nhạy cảm.
3. **UI / copy** — tiếng Việt; `next-intl` cho chuỗi hiển thị cho user.
4. **Phạm vi** — diff nhỏ, đúng yêu cầu; không refactor không liên quan.
5. **Báo cáo** — kết quả có cấu trúc; lệnh shell ghi cwd / exit code khi hữu ích.

Hook **subagentStop** có thể gửi `followup_message` checklist cho agent cha — giữ output nhất quán với checklist (nếu mâu thuẫn yêu cầu thì nêu trade-off rõ ràng).
"""

TESTING_KEYWORDS = [
    r'\btest\b', r'\btests?\b', r'\btesting\b',
    r'\bspec\b', r'\bvitest\b', r'\bunit\s*test\b',
    r'\bintegration\s*test\b', r'\be2e\b', r'\bplaywright\b',
    r'\bkiểm\s*tra\b', r'\bkiểm\s*thử\b', r'\btự\s*động\s*hóa\b',
    r'\bcoverage\b', r'\bmock\b', r'\bstub\b', r'\bfixture\b',
    r'\bassert\b', r'\bexpect\b', r'\bdescribe\b', r'\bit\s*\(',
    r'\bsmoketest\b', r'\bregression\b',
]

TESTING_CONTEXT = """## 🧪 Context: Testing Subagent — WebRAG Y tế Nhi khoa

### Stack testing hiện tại
- **Framework**: Vitest (`vitest.config.ts` trong `apps/web/` và `apps/api/`)
- **React Testing Library**: `@testing-library/react`, `@testing-library/user-event`
- **Assertions**: `expect` từ Vitest (không dùng Jest trực tiếp)
- **Coverage**: `@vitest/coverage-v8` — target: statements ≥ 80%, branches ≥ 75%

### Quy ước file test trong project
```
apps/web/src/
  components/Button/
    Button.tsx
    Button.test.tsx      ← unit test component
  hooks/
    useCAEStream.ts
    useCAEStream.test.ts ← unit test hook
  lib/api/
    client.ts
    client.test.ts

apps/api/src/
  routes/
    cae.test.ts          ← integration test route
  lib/
    rag.test.ts
```

### Patterns bắt buộc khi viết test cho project này

#### 1. Mock Supabase client
```typescript
vi.mock('@webrag/db', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
  supabaseAnon: vi.fn(),
}))
```

#### 2. Mock fetch/API calls
```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.post('/api/query', () => HttpResponse.json({ answer: 'test', citations: [] })),
  http.get('/api/episodes', () => HttpResponse.json({ data: mockEpisodes }))
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

#### 3. Test case pipeline (domain-specific)
Khi test các component liên quan đến episode, phải cover toàn bộ status:
```typescript
const EPISODE_STATUSES = [
  'pending_detection', 'pending_explain', 'pending_draft',
  'pending_approval', 'completed'
] as const

it.each(EPISODE_STATUSES)('renders correctly for status: %s', (status) => {
  // ...
})
```

#### 4. Test CAE Streaming (SSE)
```typescript
it('handles SSE stream correctly', async () => {
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"token","content":"test"}\\n\\n'))
      controller.close()
    }
  })
  // mock fetch để trả về stream
})
```

#### 5. Test RBAC / permission
```typescript
const mockUser = { id: 'u1', role: 'radiologist' as const, email: 'test@hospital.vn' }
const mockAdmin = { id: 'u2', role: 'admin' as const, email: 'admin@hospital.vn' }
// Test với từng role: clinician, radiologist, researcher, admin
```

#### 6. Vietnamese UI text assertions
```typescript
// Dùng getByText với tiếng Việt thay vì data-testid
expect(screen.getByText('Đang xử lý...')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeEnabled()
```

### Checklist khi viết test
- [ ] Mock tất cả external calls (Supabase, Ollama, embedding service)
- [ ] Test happy path + error path + loading state
- [ ] Test các role khác nhau nếu component có RBAC
- [ ] Test Vietnamese text (không hardcode tiếng Anh trong assertion)
- [ ] Không dùng `any` trong test TypeScript
- [ ] Cleanup mocks trong `afterEach`
- [ ] Test file đặt cạnh file nguồn (không tập trung vào `__tests__/`)

### Lệnh chạy test
```bash
# Chạy tất cả
yarn test

# Chạy với coverage
yarn test --coverage

# Watch mode cho development
yarn test --watch

# Chỉ test một file
yarn test apps/web/src/components/CaseList/CaseList.test.tsx
```"""

def is_testing_task(data: dict) -> bool:
    """Phát hiện task liên quan đến testing."""
    # Kiểm tra trong description và prompt
    text_to_check = " ".join([
        str(data.get("description", "")),
        str(data.get("prompt", "")),
        str(data.get("task", "")),
    ]).lower()

    if not text_to_check.strip():
        return False

    return any(re.search(pattern, text_to_check, re.IGNORECASE) for pattern in TESTING_KEYWORDS)

def main():
    data = load_input()
    parts = [UNIVERSAL_SUBAGENT_CONTEXT]
    if is_testing_task(data):
        parts.append(TESTING_CONTEXT)
    user_message = "\n\n".join(parts)
    print(json.dumps({"permission": "allow", "user_message": user_message}))

if __name__ == "__main__":
    main()
