# Mẫu Template: Quy chế phát triển — AI-Assisted Software Development Standard

## Cách sử dụng
- Copy cho mỗi dự án mới
- Thay [TÊN_DỰ_ÁN], [TÊN_LEAD], [STACK] bằng thông tin thực tế
- Giữ lại cấu trúc, bỏ sample, điền nội dung riêng

---

# [TÊN_DỰ_ÁN] — QUY CHẾ NỘI BỘ: AI-ASSISTED SOFTWARE DEVELOPMENT STANDARD

Tài liệu này tổng hợp các yêu cầu công việc từ Lead và các tiêu chuẩn kỹ thuật để đảm bảo code luôn sạch, dễ bảo trì và làm việc nhóm hiệu quả.

---

## 0) Mục đích tài liệu

Tài liệu này quy định cách team sử dụng AI trong phát triển phần mềm để đạt 4 mục tiêu:

- Tăng tốc độ triển khai
- Giữ chất lượng kỹ thuật
- Giảm rủi ro sai nghiệp vụ, sai bảo mật, sai kiến trúc
- Bảo đảm mọi thay đổi vẫn có người chịu trách nhiệm cuối cùng

**Nguyên tắc lõi:** AI là công cụ hỗ trợ kỹ sư, **không phải chủ thể tự quyết nghiệp vụ, bảo mật, kiến trúc hoặc chất lượng phát hành**. Code sinh bởi AI phải luôn được review và test giống hệt code người viết.

---

## 1) Phạm vi áp dụng

Áp dụng cho toàn bộ hoạt động:

- Phân tích yêu cầu kỹ thuật
- Thiết kế cấu trúc code
- Viết code frontend/backend
- Viết test
- Viết mock data
- Review code
- Sửa bug
- Refactor
- Tạo tài liệu kỹ thuật
- Chuẩn bị release

Áp dụng cho:

- Kỹ sư phần mềm (Developer)
- Tech Lead / Reviewer
- QA/Tester
- PM/PO khi làm ticket/spec kỹ thuật
- AI code assistant được sử dụng trong IDE, terminal, PR chat

---

## 2) Vai trò và trách nhiệm

### 2.1. Vai trò của con người

#### Developer

- Chịu trách nhiệm chính cho thay đổi mình tạo ra
- Xác minh code AI sinh ra trước khi commit
- Không được merge code mà bản thân không hiểu
- Phải test các flow chính liên quan

#### Tech Lead / Reviewer

- Kiểm tra kiến trúc, boundary, naming, maintainability
- Kiểm tra tính đúng nghiệp vụ
- Chặn merge nếu code chỉ "chạy được" nhưng rủi ro cao

#### QA / Tester

- Xác minh flow chính
- Thiết kế test case từ acceptance criteria
- Xác nhận không vỡ regression quan trọng

#### Product / BA / PM

- Làm rõ nghiệp vụ, trạng thái, rule chuyển trạng thái
- Không giao việc chỉ bằng "làm giống app kia"

### 2.2. Vai trò của AI

AI chỉ được xem là:

- Trợ lý phân tích yêu cầu
- Trợ lý viết code
- Trợ lý refactor
- Trợ lý tạo test/mock/story
- Trợ lý giải thích code
- Trợ lý draft tài liệu

AI **không** được xem là:

- Người quyết nghiệp vụ
- Người chốt kiến trúc cuối cùng
- Người review cuối cùng
- Người xác nhận bảo mật
- Người xác nhận test coverage đủ
- Người tự động merge/release không kiểm soát

---

## 3) Nguyên tắc bất di bất dịch

### 3.1. Ưu tiên quyết định

Mọi quyết định kỹ thuật phải theo thứ tự:

1. Đúng nghiệp vụ
2. Đúng dữ liệu và trạng thái
3. Dễ bảo trì
4. Dễ test
5. Rõ cấu trúc
6. Trải nghiệm người dùng
7. Tốc độ code

### 3.2. Các nguyên tắc cứng

- Không merge code mà người phụ trách không hiểu.
- Không để AI tự bịa business rule.
- Không hardcode logic nghiệp vụ trong UI nếu đó là rule hệ thống.
- Không dùng AI để "lấp chỗ trống" cho những phần chưa được định nghĩa, trừ khi có ghi chú assumption rõ ràng.
- Không chấp nhận code sinh bởi AI chỉ vì "trông đúng".
- Mọi code AI sinh ra phải được review giống như code người viết.
- Mọi thay đổi có ảnh hưởng dữ liệu, quyền hạn, approval, báo cáo phải có reviewer con người.

---

## 4) Git Workflow

### 4.1. Branching Strategy

1. **Nhánh chính:** `main` hoặc `master` — luôn ở trạng thái deployable
2. **Nhánh phát triển:** `develop` hoặc `dev` — tích hợp các feature
3. **Feature branches:** `feature/[mô-tả]`, `fix/[mô-tả]`, `chore/[mô-tả]`
4. **Nhánh release:** `release/[version]`

### 4.2. Quy tắc đặt tên nhánh

| Loại | Format | Ví dụ |
|---|---|---|
| Feature | `feature/[mô-tả-ngắn]` | `feature/user-authentication` |
| Bug fix | `fix/[mô-tả-ngắn]` | `fix/login-button-style` |
| Hotfix | `hotfix/[mô-tả]` | `hotfix/payment-crash` |
| Chore | `chore/[mô-tả]` | `chore/update-dependencies` |
| Refactor | `refactor/[mô-tả]` | `refactor/api-service-layer` |

### 4.3. Commit Message Convention

```
<type>(<scope>): <mô tả ngắn>

[可选] Body: giải thích WHY, không phải WHAT

[可选] Footer: BREAKING CHANGE, issues liên quan
```

**Loại commit:**

| Type | Mục đích |
|---|---|
| `feat` | Tính năng mới |
| `fix` | Sửa bug |
| `docs` | Chỉ thay đổi tài liệu |
| `style` | Format, không thay đổi logic |
| `refactor` | Cấu trúc lại code |
| `test` | Thêm/sửa test |
| `chore` | Công việc phụ (deps, config) |
| `perf` | Cải thiện performance |
| `ci` | CI/CD thay đổi |

### 4.4. Pull Request Process

1. Tạo PR từ feature branch → develop
2. Điền mẫu PR template:
   - Mô tả thay đổi
   - Linked issues/tickets
   - Screenshots (nếu có UI)
   - Test plan
   - Breaking changes
3. Request review từ reviewer được chỉ định
4. Không merge khi tests fail hoặc có unresolved comments
5. Squash merge vào develop
6. Reviewer merge vào main khi release

---

## 5) Code Review Checklist

### 5.1. Bắt buộc — PR bị từ chối nếu vi phạm

- [ ] Code không được debug/log thừa (console.log, print, logger.debug thừa)
- [ ] Không có dead code (comment cũ, code thử nghiệm, function không dùng)
- [ ] Không hardcode credentials, API key, secret trong code
- [ ] Không commit file lớn (binary, image > 500KB, video)
- [ ] Không có linting error
- [ ] Tests pass, coverage không giảm

### 5.2. Nên có — PR có thể được yêu cầu cải thiện

- [ ] Code có JSDoc/TypeScript cho hàm public
- [ ] Naming nhất quán, self-descriptive
- [ ] Có unit test cho logic phức tạp
- [ ] Error handling đầy đủ
- [ ] Naming cho magic numbers/constants

### 5.3. Luôn kiểm tra kỹ

- [ ] Business logic đúng nghiệp vụ, không phải AI "đoán"
- [ ] Dữ liệu validate đầy đủ, không rely trên happy path
- [ ] Auth/permission check đầy đủ
- [ ] Naming và structure nhất quán với codebase hiện tại
- [ ] Không phá breaking change không được document

---

## 6) Frontend Standards

### 6.1. Cấu trúc thư mục

```
src/
├── components/        # Shared UI components
│   └── [component]/
│       ├── index.jsx
│       └── [component].scss
├── features/          # Feature-based folders
│   └── [feature]/
│       ├── components/
│       ├── services/
│       ├── hooks/
│       └── [feature].jsx
├── services/          # API layer
├── hooks/             # Shared hooks
├── utils/             # Shared utilities
├── constants/         # Shared constants
├── styles/            # Global styles, theme
└── App.jsx
```

### 6.2. Component Standards

- Một component = một file JSX chính + một file SCSS riêng
- Props phải có default values hoặc PropTypes validation
- Mỗi component xử lý đủ state: loading, empty, error, normal
- Form phải có: idle, submitting, error, success states
- Không fetch trực tiếp trong component trình bày
- Mọi API call phải qua service layer

### 6.3. Naming Conventions

| Loại | Format | Ví dụ |
|---|---|---|
| Component | PascalCase | `UserProfile.jsx` |
| Hook | camelCase, prefix `use` | `useAuth.js` |
| Service | camelCase | `authService.js` |
| Constant | SCREAMING_SNAKE | `USER_ROLES` |
| SCSS file | kebab-case | `user-profile.scss` |
| Utility function | camelCase | `formatDate.js` |

### 6.4. State Management

- Đặt state đúng tầng: local → service → global store
- Không prop-drill quá 2 level
- Dùng context/redux cho state dùng chung nhiều nơi
- Side effects phải trong useEffect hoặc action handler

### 6.5. SCSS Standards

- Dùng `@use` thay vì `@import` (Sass best practice)
- Tổ chức: variables, mixins, functions → base → layout → components
- Không viết global override lẫn nhau
- BEM naming nhất quán nếu không dùng CSS Modules
- Mỗi component có file SCSS riêng, scoped

---

## 7) API & Backend Standards

### 7.1. RESTful Conventions

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/users` | Lấy danh sách |
| GET | `/users/:id` | Lấy một bản ghi |
| POST | `/users` | Tạo mới |
| PUT | `/users/:id` | Cập nhật toàn phần |
| PATCH | `/users/:id` | Cập nhật từng phần |
| DELETE | `/users/:id` | Xóa |

### 7.2. HTTP Status Codes

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Created |
| 400 | Bad Request (validate fail) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity (business rule fail) |
| 500 | Internal Server Error |

### 7.3. API Response Format

```json
{
  "data": { },
  "meta": { "page": 1, "total": 100 },
  "error": null
}
```

Error response:
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mô tả lỗi",
    "details": [ { "field": "email", "message": "Invalid format" } ]
  }
}
```

### 7.4. Validation Rules

- Validate tất cả input từ client (không trust client data)
- Sanitize input trước khi lưu
- Return specific error message cho từng field
- Dùng schema validation library

---

## 8) Testing Standards

### 8.1. Test Pyramid

```
        /\
       /e2e\        ← Ít nhất, chậm nhất, cover critical flows
      /------\
     /integrat.\   ← Vừa đủ, cover API và service interaction
    /----------\
   /  unit tests \ ← Nhiều nhất, nhanh nhất, cover logic
  /--------------\
```

### 8.2. Test File Naming

- Unit: `[file].test.js` hoặc `[file].spec.js`
- Integration: `[feature].integration.test.js`
- E2E: `[flow].e2e.test.js`

### 8.3. Test Structure (AAA Pattern)

```javascript
describe('Tên function', () => {
  it('nên làm gì khi input X', () => {
    // Arrange — setup data và dependencies
    const input = buildValidInput();

    // Act — gọi function đang test
    const result = myFunction(input);

    // Assert — kiểm tra kết quả
    expect(result).toBe(expected);
  });
});
```

### 8.4. Coverage Requirements

- Coverage tối thiểu: **80%** cho mọi PR
- Coverage không được giảm so với branch gốc
- Critical paths (auth, payment, data mutation) cần **90%+**

---

## 9) Security Standards

### 9.1. OWASP Top 10 Prevention

1. **Broken Access Control** — Kiểm tra permission ở mọi endpoint
2. **Cryptographic Failures** — Không lưu plain text, dùng HTTPS
3. **Injection** — Sanitize input, dùng parameterized queries
4. **Insecure Design** — Threat model cho feature mới
5. **Security Misconfiguration** — Không commit secrets, validate env vars
6. **Vulnerable Components** — Update dependencies, audit npm/pip
7. **Auth Failures** — Password hashing, JWT expiry, rate limit
8. **Integrity Failures** — Integrity check cho data từ client
9. **Logging & Monitoring** — Log security events, alert anomalies
10. **SSRF** — Validate và sanitize URL input

### 9.2. Secrets Management

- **Tuyệt đối không** commit credentials vào git
- Dùng `.env.example` làm template, `.env` trong `.gitignore`
- Rotate secrets định kỳ
- Secrets trong CI/CD dùng vault hoặc secret manager

---

## 10) Documentation Standards

### 10.1. Khi nào cần viết docs

| Loại thay đổi | Yêu cầu |
|---|---|
| API endpoint mới | Cập nhật API docs, request/response examples |
| Cấu trúc data thay đổi | Cập nhật schema docs |
| Business rule thay đổi | Cập nhật spec hoặc decision log |
| Config mới | Comment trong config file |
| Breaking change | Migration guide, changelog |

### 10.2. README Standards

Mỗi repo phải có README gồm:

- Mục đích project
- Cách setup (local dev)
- Cách chạy tests
- Environment variables cần thiết
- Deployment instructions

---

## 11) Performance Standards

- FCP < 2s, LCP < 4s trên mobile 3G
- Bundle size không tăng > 10% sau PR
- API response < 500ms cho read, < 1s cho write
- Không load resource không cần thiết
- Lazy load components và routes
- Cache appropriately (API response, static assets)

---

## 12) Monitoring & Error Handling

### 12.1. Error Handling Checklist

- Mọi API call phải có error handling
- Error messages phải user-friendly, không expose internals
- Errors phải được log với context đầy đủ
- Retry logic cho transient failures
- Fallback UI khi service unavailable

### 12.2. Logging Standards

- Log level: DEBUG, INFO, WARN, ERROR
- Log format: `[timestamp] [level] [service] [traceId] message`
- Không log sensitive data (password, token, PII)
- Structure logs (JSON) cho machine parsing

---

## 13) Kết luận chung

Quy chế này áp dụng cho mọi thay đổi trong dự án, không phân biệt do AI hay người viết.

**Nguyên tắc duy nhất:** Mọi thay đổi đều phải có người chịu trách nhiệm. AI sinh code → developer review → reviewer approve → merge.

Code chạy được ≠ code đủ tốt để merge.