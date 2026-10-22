# AI Chatbox — Fullstack Portfolio Project

## 1. Mục tiêu

Xây dựng ứng dụng AI Chatbox có trải nghiệm tương tự ChatGPT, dùng làm portfolio ứng tuyển Fullstack Developer.

**Định hướng:** hoàn thiện MVP trước, sau đó bổ sung tính năng nâng cao. Frontend không gọi AI provider trực tiếp; mọi request AI đi qua backend để bảo vệ API key và kiểm soát dữ liệu. Triển khai theo **lát cắt dọc** (mỗi giai đoạn gồm cả FE và BE) để luôn có sản phẩm chạy được.

## 2. Công nghệ

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Giao diện và routing |
| UI | Tailwind CSS, shadcn/ui | Thiết kế giao diện |
| Markdown | react-markdown, rehype-sanitize (không bật rehype-raw) | Render Markdown an toàn |
| Client/UI state | Zustand | Trạng thái giao diện và buffer streaming tạm thời |
| Server state | TanStack Query | Fetch, cache, mutation, đồng bộ dữ liệu |
| Validation FE | Zod | Kiểm tra dữ liệu đầu vào |
| Backend | Java 21+ và Spring Boot (virtual threads) | REST API, nghiệp vụ, điều phối AI |
| Security | Spring Security, JWT lưu trong cookie `HttpOnly; Secure; SameSite`, BCrypt/Argon2 | Xác thực và phân quyền |
| Persistence | Spring Data JPA, Hibernate | Truy cập dữ liệu |
| Database | PostgreSQL | Tài khoản, hội thoại, tin nhắn |
| Migration | Flyway | Quản lý thay đổi schema |
| AI | OpenAI API hoặc provider tương đương (đặt sau interface `AiClient`) | Sinh câu trả lời |
| Streaming | Server-Sent Events (SSE) qua `SseEmitter`; FE dùng `fetch` + `ReadableStream` hoặc `@microsoft/fetch-event-source` | Truyền phản hồi theo thời gian thực |
| API docs | springdoc-openapi; sinh TypeScript types từ OpenAPI | Tài liệu API, tránh lệch FE/BE |
| Rate limit | Bucket4j hoặc filter tự viết | Chống lạm dụng |
| Testing | JUnit, Mockito, Testcontainers, WireMock/fake AI client, Vitest, Playwright | Kiểm thử |
| Deployment | Docker, CI/CD | Đóng gói và triển khai |

## 3. Tính năng chính

### MVP — Bắt buộc
- Giao diện chat responsive, sidebar và danh sách hội thoại.
- Gửi câu hỏi, nhận câu trả lời từ AI API.
- Streaming câu trả lời theo từng chunk.
- **Stop generation:** hủy phản hồi đang stream (client `AbortController`, server hủy call tới provider).
- Render Markdown và code block; copy nội dung.
- Tạo chat mới, xem lịch sử, đổi tên và xóa hội thoại; tự sinh title từ tin nhắn đầu tiên.
- Đăng ký, đăng nhập và phân quyền theo người dùng.
- Lưu lịch sử chat vào PostgreSQL.
- Trạng thái loading, lỗi, timeout.
- **Rate limit và quota cơ bản theo user** (số tin/ngày, giới hạn login/register/chat) để demo công khai không bị đốt API key.
- Unit test, integration test cơ bản.
- Docker và tài liệu hướng dẫn chạy local.

### Có thể bổ sung ở V2
- Chỉnh sửa câu hỏi, tạo lại câu trả lời.
- Chuyển model nếu provider hỗ trợ.
- Tìm kiếm và xuất hội thoại ra Markdown.
- Dashboard usage chi tiết theo token.
- Đính kèm file và hỏi đáp tài liệu (RAG) sau khi MVP ổn định.

## 4. Kiến trúc tổng quan

```text
Next.js Frontend
  ├── UI / React
  ├── Zustand: UI state + buffer streaming
  └── TanStack Query: server state
           │ REST API / SSE (cùng origin qua Next.js rewrites, hoặc CORS có credentials)
           ▼
Spring Boot Backend
  ├── Authentication & Authorization
  ├── Conversation / Message services
  ├── AI provider integration (AiClient)
  └── Validation, rate limit, error handling, logging
       │                    │
       ▼                    ▼
 PostgreSQL              AI Provider
```

**Luồng gửi tin nhắn (streaming):**
1. Frontend gửi nội dung và conversation ID bằng `POST` (đọc stream bằng `fetch`, không dùng `EventSource` vì chỉ hỗ trợ `GET`).
2. Backend xác thực người dùng, kiểm tra quyền sở hữu hội thoại, validate input, kiểm tra rate limit/quota và chặn nếu hội thoại đang có một message `PENDING` khác.
3. Backend lưu tin nhắn user (`COMPLETED`) và tạo sẵn message `ASSISTANT` trạng thái `PENDING`; chuẩn bị context (system prompt + N tin nhắn gần nhất trong ngưỡng token/ký tự). Transaction đóng ngay sau bước này.
4. Backend gọi AI provider và chuyển chunk về frontend qua SSE với các event `delta`, `done`, `error`. **Không giữ DB transaction/connection mở trong lúc stream.**
5. Kết thúc:
   - Hoàn tất → cập nhật nội dung đầy đủ, `COMPLETED`, ghi token usage nếu có.
   - Provider lỗi giữa chừng → `FAILED` (kèm `error_code`), gửi event `error`.
   - Client ngắt kết nối/stop → lưu phần nội dung đã nhận, `CANCELLED`, hủy call tới provider.
6. Job định kỳ chuyển các message `PENDING` quá hạn (ví dụ server sập) sang `FAILED`.

**Quy ước SSE:** mỗi event có `type` (`delta` | `done` | `error`) và payload JSON; gửi heartbeat định kỳ để proxy không đóng kết nối.

## 5. Database ban đầu

### `users`
- `id` (UUID, primary key)
- `email` (unique, chuẩn hóa lowercase hoặc dùng `citext`)
- `password_hash`
- `created_at`

### `conversations`
- `id` (UUID, primary key)
- `user_id` (foreign key → users)
- `title`
- `created_at`
- `updated_at`

### `messages`
- `id` (UUID, primary key)
- `conversation_id` (foreign key → conversations, `ON DELETE CASCADE`)
- `role` (`USER`, `ASSISTANT`; thêm `SYSTEM` nếu cần)
- `content`
- `status` (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`)
- `error_code` (nullable, dùng khi `FAILED`)
- `model` (nullable, model đã dùng cho message ASSISTANT)
- `prompt_tokens`, `completion_tokens` (nullable, phục vụ kiểm soát chi phí/quota)
- `created_at`
- `updated_at`

### `usage` (hoặc đếm từ `messages`, tùy cách làm quota)
- Theo dõi số tin/token theo user theo ngày để áp quota.

**Index:**
- `conversations(user_id, updated_at DESC)` cho danh sách hội thoại.
- `messages(conversation_id, created_at)` cho lịch sử; dùng thêm cột thứ tự hoặc khóa phụ (id tăng dần) vì `created_at` có thể trùng.

**Lưu ý:** dùng migration (Flyway) để quản lý schema; phân trang cursor cho cả conversations và messages; luôn kiểm tra quyền sở hữu hội thoại khi đọc, sửa hoặc xóa; chốt xóa cứng hay xóa mềm ngay từ đầu (MVP: xóa cứng + cascade).

## 6. API endpoints đề xuất

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Đăng ký |
| `POST` | `/api/v1/auth/login` | Đăng nhập (set cookie) |
| `POST` | `/api/v1/auth/logout` | Đăng xuất (xóa cookie) |
| `GET` | `/api/v1/auth/me` | Thông tin tài khoản |
| `POST` | `/api/v1/conversations` | Tạo hội thoại |
| `GET` | `/api/v1/conversations` | Danh sách hội thoại, phân trang |
| `GET` | `/api/v1/conversations/{id}` | Chi tiết hội thoại |
| `PATCH` | `/api/v1/conversations/{id}` | Đổi tiêu đề |
| `DELETE` | `/api/v1/conversations/{id}` | Xóa hội thoại |
| `GET` | `/api/v1/conversations/{id}/messages` | Lịch sử tin nhắn, phân trang cursor |
| `POST` | `/api/v1/conversations/{id}/messages/stream` | Gửi tin nhắn, response SSE |
| `POST` | `/api/v1/conversations/{id}/messages` | (Tùy chọn) Gửi tin nhắn, response hoàn chỉnh — hữu ích cho test; bỏ nếu muốn giảm bề mặt bảo trì |

Endpoint có thể điều chỉnh theo thiết kế thực tế. Chuẩn hóa DTO, validation (Bean Validation ở BE, Zod ở FE) và định dạng lỗi API (mã lỗi ổn định để UI xử lý). Với cookie auth cần cấu hình CSRF hoặc `SameSite` phù hợp.

## 7. Cấu trúc thư mục gợi ý

### Frontend
```text
frontend/src/
├── app/
│   ├── (auth)/login/
│   ├── (auth)/register/
│   ├── (chat)/chat/
│   └── layout.tsx
├── components/chat/
├── components/sidebar/
├── features/auth/
├── features/conversations/
├── features/messages/
├── lib/api/
├── stores/
├── hooks/
├── schemas/
└── types/
```

### Backend
```text
backend/src/main/
├── java/com/example/aichat/
│   ├── auth/
│   ├── user/
│   ├── conversation/
│   ├── message/
│   ├── ai/
│   ├── config/
│   ├── security/
│   └── common/
└── resources/
    ├── application.yml
    └── db/migration/
```

Tổ chức backend theo domain/feature; mỗi domain có controller, service, repository, DTO và entity phù hợp. Tránh tạo abstraction không cần thiết quá sớm (riêng `AiClient` nên có vì cần mock khi test và đổi provider).

## 8. Lộ trình triển khai

| Giai đoạn | Nội dung | Ước tính |
|---|---|---|
| 1 | Phân tích, khởi tạo Next.js/Spring Boot, PostgreSQL, Git, Docker Compose, health-check | 3–5 ngày |
| 2 | Authentication & authorization (đăng ký, đăng nhập, cookie, CORS/proxy, BCrypt) — làm sớm để mọi API sau đó đã gắn `user_id` | 4–6 ngày |
| 3 | CRUD hội thoại và lịch sử tin nhắn (BE + FE), kiểm tra quyền sở hữu, UI chat nối API thật | 5–8 ngày |
| 4 | Tích hợp AI API (không stream), context, auto title, xử lý lỗi, fake AI client cho test | 4–6 ngày |
| 5 | SSE streaming, stop generation, lỗi giữa luồng, trạng thái message, dọn `PENDING` | 4–6 ngày |
| 6 | Rate limit, quota, hardening bảo mật (input size, log, Markdown sanitize) | 3–4 ngày |
| 7 | Unit/integration/E2E tests, tối ưu trải nghiệm | 4–6 ngày |
| 8 | Docker, CI/CD, deploy (cấu hình proxy cho SSE), README và demo | 3–5 ngày |

**Tổng dự kiến:** khoảng 30–46 ngày làm việc; nếu học và làm ngoài giờ (đặc biệt khi chưa quen Spring Security), nên dự trù khoảng 8–12 tuần hoặc hơn.

## 9. Nguyên tắc kỹ thuật quan trọng

- **Bảo vệ secret:** chỉ lưu AI API key ở backend; không dùng tiền tố `NEXT_PUBLIC_` và không commit secret.
- **Xác thực:** JWT trong cookie `HttpOnly`, không lưu token trong `localStorage`; mật khẩu băm bằng BCrypt/Argon2.
- **Phân quyền:** mọi thao tác với conversation phải kiểm tra người dùng sở hữu hội thoại.
- **Quản lý state:** TanStack Query cho dữ liệu server; Zustand cho UI state và buffer streaming; khi stream xong thì invalidate query, không ghi từng chunk vào query cache.
- **Context AI:** gửi system prompt + lịch sử gần nhất có giới hạn (theo token hoặc ký tự); tính đến token budget và chi phí.
- **Streaming:** phân biệt `delta`, `done`, `error` và trạng thái hủy; không đánh dấu hoàn tất khi AI lỗi giữa chừng; không giữ DB transaction trong lúc stream; chặn gửi đồng thời nhiều request vào cùng hội thoại.
- **Vận hành SSE:** tắt buffering ở reverse proxy (`X-Accel-Buffering: no`), gửi heartbeat, kiểm tra timeout của proxy/CDN.
- **An toàn vận hành:** giới hạn kích thước input, rate limit, quota, timeout; tránh ghi token hoặc dữ liệu nhạy cảm vào log.
- **Render an toàn:** `rehype-sanitize`, không cho HTML thô; kiểm tra URL (chặn `javascript:`).
- **Database:** dùng migration, index và transaction phù hợp; message `PENDING` quá hạn phải được dọn.
- **Testing:** ưu tiên kiểm thử quyền truy cập, lỗi provider, streaming, hủy giữa chừng và quota; mock AI provider để test không tốn tiền và không phụ thuộc mạng.

## 10. Checklist hoàn thành MVP

- [ ] Frontend và backend khởi động được.
- [ ] PostgreSQL kết nối thành công; migration hoạt động.
- [ ] Đăng ký/đăng nhập/đăng xuất và phân quyền dữ liệu.
- [ ] UI chat responsive với trạng thái loading/lỗi.
- [ ] Gửi câu hỏi và nhận câu trả lời từ AI API.
- [ ] Streaming hoạt động, stop generation và xử lý lỗi giữa luồng đúng.
- [ ] Message `PENDING` bị treo được dọn tự động.
- [ ] Lịch sử được lưu và tải lại được.
- [ ] Tạo, đổi tên (kể cả auto title), xóa hội thoại.
- [ ] Rate limit và quota hoạt động.
- [ ] Có unit test và integration test cho luồng quan trọng (dùng fake AI client).
- [ ] Docker và `.env.example` không chứa secret.
- [ ] README, ERD, sơ đồ kiến trúc, API docs (OpenAPI) và ảnh demo.
- [ ] Có link demo hoặc hướng dẫn chạy local rõ ràng.

## 11. Portfolio và phỏng vấn

Repository nên có:
- README: mục tiêu, tính năng, công nghệ và cách chạy.
- Sơ đồ kiến trúc và ERD.
- Danh sách API cùng ví dụ request/response.
- Ảnh giao diện hoặc link demo.
- Hướng dẫn cấu hình `.env.example`.
- Test cho các luồng quan trọng.
- Git commit có tổ chức.

Cần giải thích được: vì sao chọn SSE và vì sao phải dùng `fetch` thay `EventSource` với `POST`, cách quản lý state, cách xây dựng context AI, vòng đời message khi stream/hủy/lỗi, bảo vệ dữ liệu giữa các user và kiểm soát chi phí AI.

## 12. Thứ tự bắt đầu

1. Tạo Git repository.
2. Khởi tạo Next.js + TypeScript + Tailwind CSS.
3. Khởi tạo Spring Boot với Spring Web, Spring Data JPA, Spring Security, Validation, Flyway và PostgreSQL driver.
4. Chạy PostgreSQL bằng Docker Compose.
5. Cấu hình biến môi trường và kết nối database.
6. Tạo health-check endpoint và xác minh hai ứng dụng chạy ổn định.
7. Làm auth trước (giai đoạn 2), sau đó tiếp tục theo lộ trình, hoàn thành từng giai đoạn trước khi chuyển sang giai đoạn kế tiếp.
