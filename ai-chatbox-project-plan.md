# AI Chatbox — Fullstack Portfolio Project

> **📍 Bước hiện tại: 1.4** — xem [mục 12](#12-kế-hoạch-code-chi-tiết-và-tiến-độ). Sau mỗi bước: tick `[x]`, cập nhật dòng này, commit.

## 1. Mục tiêu

Xây dựng ứng dụng AI Chatbox có trải nghiệm tương tự ChatGPT, dùng làm portfolio ứng tuyển Fullstack Developer.

**Định hướng:** hoàn thiện MVP trước, sau đó bổ sung tính năng nâng cao. Frontend không gọi AI provider trực tiếp; mọi request AI đi qua backend để bảo vệ API key và kiểm soát dữ liệu. Triển khai theo **lát cắt dọc** (mỗi giai đoạn gồm cả FE và BE) để luôn có sản phẩm chạy được.

**Hai backend:** làm backend **Node.js (Express + TypeScript)** trước đến hết MVP; sau đó viết thêm backend **Spring Boot** cùng nghiệp vụ, dùng chung frontend và database. Vì vậy ngay từ đầu, mọi thứ frontend nhìn thấy phải là **contract** chung, không phụ thuộc chi tiết riêng của Express:
- API: endpoint, DTO, mã lỗi — mô tả trong `contract/openapi.yaml` (nguồn sự thật duy nhất).
- SSE: tên event (`delta` | `done` | `error`) và format payload.
- Auth: tên cookie, thuộc tính cookie, claims của JWT, thuật toán băm mật khẩu **BCrypt** (để user tạo ở backend này đăng nhập được ở backend kia).
- Database schema: **Flyway chạy độc lập** (container riêng trong Docker Compose) với các file SQL trong `db/migration/` ở gốc repo là nơi duy nhất tạo/sửa schema. Không backend nào tự tạo migration: Node (Drizzle) chỉ khai báo schema để đọc/ghi type-safe; Spring sau này dùng `ddl-auto=validate` và tắt Flyway nội bộ.

## 2. Công nghệ

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Giao diện và routing |
| UI | Tailwind CSS (v4, đã cài), shadcn/ui | Thiết kế giao diện |
| Markdown | react-markdown, rehype-sanitize (không bật rehype-raw) | Render Markdown an toàn |
| Client/UI state | Zustand | Trạng thái giao diện và buffer streaming tạm thời |
| Server state | TanStack Query | Fetch, cache, mutation, đồng bộ dữ liệu (dùng ngay từ giai đoạn 2, không fetch tay trong component) |
| Validation FE | Zod | Kiểm tra dữ liệu đầu vào |
| **Backend chính (MVP)** | Node.js LTS, Express, TypeScript (strict) | REST API, nghiệp vụ, điều phối AI |
| Security (Node) | JWT (`jsonwebtoken`) trong cookie `HttpOnly; Secure; SameSite`, `bcrypt`, middleware xác thực tự viết | Xác thực và phân quyền |
| Validation BE (Node) | Zod | Validate body/params/query ở middleware |
| Persistence (Node) | Drizzle ORM + `pg` (node-postgres) | Truy cập dữ liệu type-safe, gần SQL |
| Database | PostgreSQL | Tài khoản, hội thoại, tin nhắn |
| Migration | Flyway chạy độc lập (Docker), SQL thuần trong `db/migration/` | Quản lý thay đổi schema, dùng chung cho cả hai backend |
| AI | OpenAI API hoặc provider tương đương (đặt sau interface `AiClient`) | Sinh câu trả lời |
| Streaming | SSE: Node ghi trực tiếp `res.write` + `AbortController` để hủy; FE dùng `fetch` + `ReadableStream` hoặc `@microsoft/fetch-event-source` | Truyền phản hồi theo thời gian thực |
| API docs | `contract/openapi.yaml` (contract-first); sinh TypeScript types từ contract | Tài liệu API, tránh lệch FE/BE và giữa hai backend |
| Rate limit (Node) | `express-rate-limit` hoặc middleware tự viết | Chống lạm dụng |
| Testing (Node + FE) | Vitest, Supertest, Testcontainers, fake AI client, Playwright | Kiểm thử |
| **Backend thứ hai (sau MVP)** | Java 21+, Spring Boot (virtual threads), Spring Security, Spring Data JPA, `SseEmitter`, Bucket4j; test bằng JUnit, Mockito, Testcontainers, WireMock | Cài đặt lại cùng contract để so sánh với Node |
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
Node/Express Backend  (sau MVP: hoặc Spring Boot Backend — cùng contract, chạy một trong hai)
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

**Lưu ý:** dùng migration (Flyway độc lập, `db/migration/V<số>__<mô_tả>.sql`) để quản lý schema; schema Drizzle bên Node phải khớp migration (có integration test chạy trên DB đã migrate); phân trang cursor cho cả conversations và messages; luôn kiểm tra quyền sở hữu hội thoại khi đọc, sửa hoặc xóa; chốt xóa cứng hay xóa mềm ngay từ đầu (MVP: xóa cứng + cascade).

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

Endpoint có thể điều chỉnh theo thiết kế thực tế. Chuẩn hóa DTO, validation (Zod ở Node và FE; Bean Validation ở Spring sau này) và định dạng lỗi API (mã lỗi ổn định để UI xử lý). Với cookie auth cần cấu hình CSRF hoặc `SameSite` phù hợp.

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

### Thư mục gốc
```text
AI-chatbox/
├── frontend/
├── backend-node/        (backend chính, làm trước)
├── backend-spring/      (giai đoạn 9; đã khởi tạo sẵn, chưa dùng)
├── db/migration/        (SQL Flyway, dùng chung)
├── contract/openapi.yaml
└── docker-compose.yml   (postgres + flyway; profile `node` / `spring` để chọn backend)
```

### Backend Node
```text
backend-node/src/
├── auth/            (routes, service, middleware xác thực)
├── users/
├── conversations/
├── messages/
├── ai/              (interface AiClient, OpenAI client, fake client)
├── db/              (kết nối pg pool, schema Drizzle)
├── common/          (error handler, lỗi có mã, middleware validate)
├── config/          (đọc và validate biến môi trường bằng Zod)
├── app.ts           (tạo Express app — tách riêng để Supertest dùng)
└── server.ts        (listen port)
```

Mỗi domain gồm `*.routes.ts` (mỏng, chỉ nhận request/trả response) → `*.service.ts` (nghiệp vụ, kiểm tra quyền sở hữu) → `*.repository.ts` (truy vấn Drizzle) và `*.schemas.ts` (Zod cho request/response). Express không có DI container: truyền dependency qua tham số hàm/factory để dễ thay bằng fake khi test.

### Backend Spring (giai đoạn 9)
```text
backend-spring/src/main/
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
    └── application.yml   (không có db/migration riêng — dùng chung thư mục gốc)
```

Tổ chức backend theo domain/feature; mỗi domain có controller, service, repository, DTO và entity phù hợp (Spring) hoặc routes, service, repository, schemas (Node). Tránh tạo abstraction không cần thiết quá sớm (riêng `AiClient` nên có vì cần mock khi test và đổi provider).

## 8. Lộ trình triển khai

| Giai đoạn | Nội dung | Ước tính |
|---|---|---|
| 1 | Phân tích, khởi tạo Next.js và Express + TypeScript, PostgreSQL + Flyway bằng Docker Compose, health-check | 3–5 ngày |
| 2 | Authentication & authorization (đăng ký, đăng nhập, cookie, CORS/proxy, BCrypt); cài TanStack Query + Zod ở FE cho form auth — làm sớm để mọi API sau đó đã gắn `user_id` | 4–6 ngày |
| 3 | CRUD hội thoại và lịch sử tin nhắn (BE + FE, TanStack Query cho list/mutation), kiểm tra quyền sở hữu, UI chat nối API thật | 5–8 ngày |
| 4 | Tích hợp AI API (không stream), context, auto title, xử lý lỗi, fake AI client cho test | 4–6 ngày |
| 5 | SSE streaming, stop generation, lỗi giữa luồng, trạng thái message, dọn `PENDING` | 4–6 ngày |
| 6 | Rate limit, quota, hardening bảo mật (input size, log, Markdown sanitize) | 3–4 ngày |
| 7 | Unit/integration/E2E tests, tối ưu trải nghiệm | 4–6 ngày |
| 8 | Docker, CI/CD, deploy (cấu hình proxy cho SSE), README và demo | 3–5 ngày |
| 9 | Backend Spring Boot theo cùng contract, dùng chung DB (không migration riêng, `ddl-auto=validate`); Playwright E2E chạy được với cả hai backend; README so sánh hai cách làm. Chỉ bắt đầu khi checklist MVP đã xong | 20–30 ngày |

**Tổng dự kiến:** khoảng 30–46 ngày làm việc cho MVP (giai đoạn 1–8), cộng thêm giai đoạn 9 (Spring Security và JPA thường tốn thời gian làm quen); nếu học và làm ngoài giờ, nên dự trù khoảng 8–12 tuần cho MVP hoặc hơn.

## 9. Nguyên tắc kỹ thuật quan trọng

- **Bảo vệ secret:** chỉ lưu AI API key ở backend; không dùng tiền tố `NEXT_PUBLIC_` và không commit secret.
- **Xác thực:** JWT trong cookie `HttpOnly`, không lưu token trong `localStorage`; mật khẩu băm bằng BCrypt (chung cho cả hai backend).
- **Phân quyền:** mọi thao tác với conversation phải kiểm tra người dùng sở hữu hội thoại.
- **Quản lý state:** TanStack Query cho dữ liệu server; Zustand cho UI state và buffer streaming; khi stream xong thì invalidate query, không ghi từng chunk vào query cache.
- **Context AI:** gửi system prompt + lịch sử gần nhất có giới hạn (theo token hoặc ký tự); tính đến token budget và chi phí.
- **Node event loop:** không chạy tác vụ CPU nặng/đồng bộ trong request (dùng `bcrypt` bản async, không `*Sync`); mọi lỗi async phải đi tới error handler chung (Express 5 tự bắt promise bị reject).
- **Streaming:** phân biệt `delta`, `done`, `error` và trạng thái hủy (Node: lắng nghe `req.on('close')` để abort call tới provider); không đánh dấu hoàn tất khi AI lỗi giữa chừng; không giữ DB transaction trong lúc stream; chặn gửi đồng thời nhiều request vào cùng hội thoại.
- **Vận hành SSE:** tắt buffering ở reverse proxy (`X-Accel-Buffering: no`), gửi heartbeat, kiểm tra timeout của proxy/CDN.
- **An toàn vận hành:** giới hạn kích thước input, rate limit, quota, timeout; tránh ghi token hoặc dữ liệu nhạy cảm vào log.
- **Render an toàn:** `rehype-sanitize`, không cho HTML thô; kiểm tra URL (chặn `javascript:`).
- **Database:** dùng migration, index và transaction phù hợp; message `PENDING` quá hạn phải được dọn.
- **Contract chung:** mọi thay đổi API/SSE/cookie/mã lỗi phải cập nhật `contract/openapi.yaml` trước, rồi mới sửa code; frontend không được dựa vào hành vi chỉ một backend có.
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

Sau giai đoạn 9, có thể so sánh: tự tổ chức module/truyền dependency trong Express vs DI của Spring, event loop vs virtual threads khi stream SSE, middleware Express vs Spring Security filter chain, Drizzle vs JPA/Hibernate, Zod vs Bean Validation.

Cần giải thích được: vì sao chọn SSE và vì sao phải dùng `fetch` thay `EventSource` với `POST`, cách quản lý state, cách xây dựng context AI, vòng đời message khi stream/hủy/lỗi, bảo vệ dữ liệu giữa các user và kiểm soát chi phí AI.

## 12. Kế hoạch code chi tiết và tiến độ

### Cách theo dõi tiến độ (khi đổi máy)
- **Nguồn sự thật là file này trong Git.** Làm xong một bước: tick `[x]`, sửa dòng "📍 Bước hiện tại" ở đầu file, rồi commit kèm mã bước, ví dụ `feat(node): 1.10 add error handler`. Sang máy khác: `git pull` → đọc dòng 📍 → làm tiếp.
- Đang làm dở một bước mà phải đổi máy: commit nhánh tạm (`wip: 2.6 register service`) và thêm một dòng `- ⏸ Dở dang: <đã làm gì, còn gì>` ngay dưới bước đó (xóa khi xong).
- Bước ghi "(chốt ở bước này)" nghĩa là có lựa chọn cần quyết định trước khi code; ghi lại quyết định vào plan.
- Mỗi bước kết thúc bằng mục **Kiểm tra** — chỉ tick khi đã chạy thật và đạt.

### Thiết lập máy mới (làm một lần trên mỗi máy)
1. Cài Git, Node.js LTS, Docker Desktop (Windows cần WSL2). Kiểm tra: `node -v`, `npm -v`, `docker compose version`.
2. `git clone` rồi `git pull` để lấy tiến độ mới nhất.
3. Tạo `.env` từ `.env.example` ở gốc repo (và trong `backend-node/` nếu có). **`.env` không có trong Git** — lưu secret (AI API key, JWT secret) ở trình quản lý mật khẩu để chép sang máy khác.
4. `npm install` trong `frontend/` và `backend-node/` (khi các thư mục này đã có `package.json`).
5. `docker compose up -d postgres` → `docker compose run --rm flyway migrate` (từ bước 1.6 trở đi).

---

### Giai đoạn 1 — Khởi tạo và hạ tầng

- [x] **1.1** Tạo Git repository và `.gitignore` gốc (bỏ qua `.env`).
- [x] **1.2** Khởi tạo Next.js + TypeScript + Tailwind CSS trong `frontend/`.
- [x] **1.3** Khởi tạo Spring Boot trong `backend-spring/` (để dành cho giai đoạn 9, không đụng tới cho đến lúc đó).
- [ ] **1.4** Cài công cụ trên máy: Node.js LTS, Docker Desktop.
  - Kiểm tra: `node -v`, `npm -v`, `docker --version`, `docker compose version` đều in phiên bản.
- [ ] **1.5** Docker Compose cho PostgreSQL — `docker-compose.yml` (service `postgres`, named volume, healthcheck), `.env.example` (tên DB, user, mật khẩu mẫu).
  - Kiểm tra: `docker compose up -d postgres` → `docker compose ps` báo `healthy`; `docker compose exec postgres psql -U <user> -d <db> -c "select 1"`.
- [ ] **1.6** Service Flyway trong Compose, đọc `db/migration/`; migration đầu `V1__enable_extensions.sql` (bật `citext`).
  - Kiểm tra: `docker compose run --rm flyway migrate` thành công; `flyway info` thấy V1 `Success`; bảng `flyway_schema_history` tồn tại.
- [ ] **1.7** Khởi tạo `backend-node/`: `package.json`, TypeScript strict (`tsconfig.json`), Express 5, script `dev` (chạy watch), `build`, `start`.
  - Kiểm tra: `npm run dev` khởi động không lỗi; `npm run build` sinh `dist/`.
- [ ] **1.8** ESLint + Prettier cho `backend-node/`; thêm Prettier cho `frontend/` (ESLint đã có).
  - Kiểm tra: `npm run lint` và `npm run format:check` chạy được ở cả hai.
- [ ] **1.9** Cấu hình biến môi trường — `backend-node/src/config/env.ts` đọc và validate bằng Zod, dừng app ngay nếu thiếu/sai.
  - Kiểm tra: xóa một biến bắt buộc → app báo lỗi rõ tên biến và thoát.
- [ ] **1.10** Khung Express — `app.ts` (tạo app) tách khỏi `server.ts` (listen); `common/errors.ts` (lớp `AppError` có `code`), error handler chung trả `{ "error": { "code", "message" } }`, handler 404.
  - Kiểm tra: `curl` một route không tồn tại → 404 JSON đúng format.
- [ ] **1.11** Kết nối DB — `db/client.ts` (pool `pg` + Drizzle), đóng pool khi tắt app (SIGINT/SIGTERM).
  - Kiểm tra: app khởi động log kết nối OK; Ctrl+C tắt sạch, không treo.
- [ ] **1.12** `GET /api/v1/health` chạy `select 1` tới DB.
  - Kiểm tra: `curl` → 200 `{ "status": "ok" }`; dừng postgres → 503 với mã lỗi `DB_UNAVAILABLE`.
- [ ] **1.13** Setup Vitest + Supertest; test đầu tiên cho 404 và health.
  - Kiểm tra: `npm test` xanh.
- [ ] **1.14** `contract/openapi.yaml` khởi đầu: `info`, schema `Error`, endpoint health.
  - Kiểm tra: mở file bằng Swagger Editor/preview của IDE không báo lỗi.
- [ ] **1.15** FE gọi BE qua Next.js rewrites (`/api/*` → backend Node; chốt ở bước này: rewrites hay CORS) — sửa `next.config.ts`, trang tạm hiển thị kết quả health; dọn trang mẫu của Next.
  - Kiểm tra: mở `http://localhost:3000` thấy "Backend: ok".
- [ ] **1.16** `README.md` gốc: yêu cầu cài đặt, các lệnh chạy local.
  - **Checklist giai đoạn 1:** postgres + flyway chạy; FE + BE Node chạy; health 200; test xanh; lint sạch.

### Giai đoạn 2 — Authentication & authorization

- [ ] **2.1** Migration `V2__create_users.sql` (`id uuid`, `email citext unique`, `password_hash`, `created_at`).
  - Kiểm tra: `flyway migrate` → `\d users` đúng cột/ràng buộc.
- [ ] **2.2** Hạ tầng integration test: Testcontainers khởi động PostgreSQL và chạy migration từ `db/migration/` trước test.
  - Kiểm tra: một test đơn giản truy vấn bảng `users` chạy xanh.
- [ ] **2.3** Drizzle schema `users` + `users/users.repository.ts` (`findByEmail`, `create`).
  - Kiểm tra: integration test cho repository xanh; email trùng (khác hoa/thường) bị chặn.
- [ ] **2.4** Contract auth trong `openapi.yaml`: register/login/logout/me, mã lỗi `VALIDATION_ERROR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`; tên và thuộc tính cookie.
  - Kiểm tra: review contract cùng nhau trước khi code.
- [ ] **2.5** Middleware validate bằng Zod — `common/validate.ts` (body/params/query) trả `VALIDATION_ERROR` kèm chi tiết field.
  - Kiểm tra: unit test với body sai → 400 đúng format.
- [ ] **2.6** `POST /auth/register` — service chuẩn hóa email, `bcrypt.hash` (async), trùng → 409 `EMAIL_TAKEN`; response không chứa `password_hash`.
  - Kiểm tra: test thành công / trùng email / input sai.
- [ ] **2.7** `POST /auth/login` — so khớp bcrypt, ký JWT, set cookie `HttpOnly; SameSite=Lax; Secure` (Secure bật ở production).
  - Kiểm tra: test đúng/sai mật khẩu; header `Set-Cookie` đủ thuộc tính; thông báo lỗi không tiết lộ email có tồn tại hay không.
- [ ] **2.8** Middleware `requireAuth` (đọc cookie, verify JWT, gắn user vào request) + `GET /auth/me`.
  - Kiểm tra: test không cookie / cookie sai / hết hạn → 401 `UNAUTHENTICATED`; cookie đúng → 200.
- [ ] **2.9** `POST /auth/logout` xóa cookie.
  - Kiểm tra: test logout xong gọi `/me` → 401.
- [ ] **2.10** Chống CSRF (chốt ở bước này: `SameSite=Lax` + kiểm tra header `Origin` cho request thay đổi dữ liệu, hay CSRF token).
  - Kiểm tra: test request POST với `Origin` lạ bị từ chối.
- [ ] **2.11** FE: sinh TypeScript types từ contract (`openapi-typescript`) + `lib/api/client.ts` (fetch có `credentials`, parse lỗi theo format chung).
  - Kiểm tra: `npm run gen:api` sinh file types; typecheck sạch.
- [ ] **2.12** FE: cài TanStack Query, `QueryClientProvider` trong layout (+ Devtools ở dev).
  - Kiểm tra: app chạy, Devtools hiển thị.
- [ ] **2.13** FE: khởi tạo shadcn/ui, thêm `button`, `input`, `label`, `card`.
  - Kiểm tra: một trang test hiển thị component đúng style Tailwind.
- [ ] **2.14** FE: trang `/register` — schema Zod trong `schemas/`, mutation TanStack Query, hiển thị lỗi field và lỗi server (chốt ở bước này: dùng react-hook-form hay tự quản lý state form).
  - Kiểm tra: đăng ký thành công; email trùng hiện thông báo đúng.
- [ ] **2.15** FE: trang `/login` + hook `useMe` (query `/auth/me`).
  - Kiểm tra: đăng nhập xong chuyển trang; reload vẫn đăng nhập (cookie).
- [ ] **2.16** FE: bảo vệ route `/chat` (chưa đăng nhập → chuyển về `/login`) + nút logout.
  - **Checklist giai đoạn 2:** đăng ký/đăng nhập/đăng xuất chạy thật trên UI; cookie `HttpOnly`; test auth BE xanh.

### Giai đoạn 3 — Hội thoại và lịch sử tin nhắn

- [ ] **3.1** Migration `V3__create_conversations.sql` + index `(user_id, updated_at DESC)`.
- [ ] **3.2** Migration `V4__create_messages.sql` (role, status, error_code, model, tokens, cột thứ tự `seq bigserial`, `ON DELETE CASCADE`) + index `(conversation_id, seq)`.
  - Kiểm tra (3.1–3.2): `flyway migrate` thành công; xóa conversation thì message bị xóa theo.
- [ ] **3.3** Drizzle schema `conversations`, `messages` + `conversations.repository.ts`.
  - Kiểm tra: integration test repository xanh.
- [ ] **3.4** Contract conversations/messages + định dạng phân trang cursor (`items`, `nextCursor`).
- [ ] **3.5** `POST /conversations` và `GET /conversations` (cursor theo `updated_at, id`).
  - Kiểm tra: test tạo nhiều hội thoại, phân trang đúng thứ tự, không trùng/sót.
- [ ] **3.6** `GET/PATCH/DELETE /conversations/{id}` — kiểm tra sở hữu ở service; không phải chủ → 404 `CONVERSATION_NOT_FOUND` (không tiết lộ là tồn tại).
  - Kiểm tra: test user B không đọc/sửa/xóa được hội thoại của user A.
- [ ] **3.7** `messages.repository.ts` + `GET /conversations/{id}/messages` (cursor theo `seq`).
  - Kiểm tra: test phân trang + kiểm tra sở hữu.
- [ ] **3.8** FE: layout chat — sidebar + vùng chat, responsive (sidebar thu gọn trên mobile).
- [ ] **3.9** FE: sidebar danh sách hội thoại (`useInfiniteQuery`), trạng thái loading/rỗng/lỗi.
- [ ] **3.10** FE: tạo chat mới, đổi tên, xóa (mutation + invalidate query).
- [ ] **3.11** FE: trang `/chat/[id]` hiển thị lịch sử tin nhắn (cuộn lên để tải thêm).
- [ ] **3.12** FE: render Markdown (`react-markdown` + `rehype-sanitize`), code block, nút copy.
  - **Checklist giai đoạn 3:** CRUD hội thoại chạy trên UI; dữ liệu tách biệt giữa hai user; test quyền truy cập xanh.

### Giai đoạn 4 — Tích hợp AI (chưa stream)

- [ ] **4.1** `ai/ai-client.ts` (interface `AiClient`, kiểu dữ liệu vào/ra) + `ai/fake-ai-client.ts`.
- [ ] **4.2** `ai/openai-client.ts` (API key, model, timeout từ env) — chọn client theo env `AI_PROVIDER=openai|fake`.
  - Kiểm tra: script thử gọi thật một câu ngắn (chạy tay, không đưa vào test).
- [ ] **4.3** Context builder: system prompt + N tin gần nhất trong ngân sách ký tự.
  - Kiểm tra: unit test cắt lịch sử đúng ngưỡng, giữ thứ tự.
- [ ] **4.4** `POST /conversations/{id}/messages` (không stream): lưu tin user, gọi AI, lưu tin assistant; chặn khi đang có `PENDING` → 409 `GENERATION_IN_PROGRESS`.
  - Kiểm tra: test với fake client (thành công, đang PENDING).
- [ ] **4.5** Map lỗi provider sang mã ổn định (`AI_TIMEOUT`, `AI_PROVIDER_ERROR`, `AI_RATE_LIMITED`) và status `FAILED`.
  - Kiểm tra: test fake client ném lỗi → message `FAILED` có `error_code`.
- [ ] **4.6** Auto title từ tin nhắn đầu tiên.
  - Kiểm tra: test hội thoại mới có title sau tin đầu, không đổi ở tin sau.
- [ ] **4.7** FE: ô soạn tin (Enter gửi, Shift+Enter xuống dòng), gửi qua mutation, hiển thị loading/lỗi.
  - **Checklist giai đoạn 4:** hỏi và nhận câu trả lời thật trên UI; test lỗi provider xanh.

### Giai đoạn 5 — Streaming SSE

- [ ] **5.1** Contract SSE: mô tả event `delta` / `done` / `error`, payload, heartbeat trong `contract/`.
- [ ] **5.2** `AiClient.stream()` trả async iterable, nhận `AbortSignal`; fake client stream từng chunk.
- [ ] **5.3** `common/sse.ts`: set header (`text/event-stream`, `X-Accel-Buffering: no`), hàm ghi event, heartbeat định kỳ.
- [ ] **5.4** `POST /conversations/{id}/messages/stream`: transaction ngắn tạo tin user + assistant `PENDING` → stream `delta` → `done` và cập nhật `COMPLETED`.
  - Kiểm tra: test đọc stream bằng Supertest nhận đúng chuỗi event; DB `COMPLETED`.
- [ ] **5.5** Lỗi giữa luồng → event `error`, message `FAILED`.
  - Kiểm tra: test fake client lỗi sau 2 chunk.
- [ ] **5.6** Client ngắt (`req.on('close')`) → abort provider, lưu phần đã nhận, `CANCELLED`.
  - Kiểm tra: test hủy giữa chừng → DB `CANCELLED` với nội dung một phần.
- [ ] **5.7** Job dọn `PENDING` quá hạn → `FAILED` (chạy định kỳ + khi khởi động).
  - Kiểm tra: test message PENDING cũ bị chuyển trạng thái.
- [ ] **5.8** FE: `lib/api/sse.ts` đọc SSE bằng `fetch` + `ReadableStream`, parse event (chốt ở bước này: tự viết hay `@microsoft/fetch-event-source`).
  - Kiểm tra: unit test Vitest cho parser (event bị cắt giữa chunk).
- [ ] **5.9** FE: Zustand store buffer streaming + hook `useStreamMessage`; hiển thị chữ chạy dần.
- [ ] **5.10** FE: nút Stop (`AbortController`); stream xong/hủy thì invalidate query tin nhắn.
- [ ] **5.11** FE: hiển thị trạng thái `FAILED` / `CANCELLED` trên từng tin nhắn.
  - **Checklist giai đoạn 5:** stream mượt, stop hoạt động, lỗi giữa luồng hiển thị đúng, không còn PENDING treo.

### Giai đoạn 6 — Rate limit, quota, hardening

- [ ] **6.1** Rate limit login/register theo IP → 429 `RATE_LIMITED`.
- [ ] **6.2** Rate limit gửi tin theo user.
- [ ] **6.3** Quota số tin/ngày theo user (chốt ở bước này: đếm từ `messages` hay bảng `usage`) → 429 `QUOTA_EXCEEDED`.
  - Kiểm tra (6.1–6.3): test vượt ngưỡng bị chặn, qua ngày mới được reset.
- [ ] **6.4** Giới hạn kích thước: body limit của Express, độ dài nội dung tin nhắn (Zod + contract).
- [ ] **6.5** Logging có cấu trúc + request id; không log cookie/token/nội dung tin nhắn (chốt thư viện log ở bước này).
- [ ] **6.6** Rà soát render an toàn: chặn link `javascript:`, không HTML thô.
  - Kiểm tra: test FE render payload độc hại không thực thi.
- [ ] **6.7** FE: thông báo thân thiện cho 429 / quota / timeout.
  - **Checklist giai đoạn 6:** demo công khai không bị lạm dụng; log không chứa dữ liệu nhạy cảm.

### Giai đoạn 7 — Kiểm thử và trải nghiệm

- [ ] **7.1** Rà test BE theo plan mục 9: quyền truy cập, lỗi provider, streaming, hủy, quota — bổ sung chỗ thiếu.
- [ ] **7.2** FE: Vitest + Testing Library cho component/hook chính (form auth, parser SSE, store).
- [ ] **7.3** Playwright E2E: đăng ký → đăng nhập → tạo chat → gửi tin (BE chạy `AI_PROVIDER=fake`).
- [ ] **7.4** UX: tự cuộn khi stream, focus ô nhập, phím tắt, trạng thái rỗng, mobile.
  - **Checklist giai đoạn 7:** toàn bộ test xanh khi chạy local một lệnh.

### Giai đoạn 8 — Docker, CI/CD, deploy

- [ ] **8.1** Dockerfile `backend-node/` (multi-stage, chạy user không phải root).
- [ ] **8.2** Dockerfile `frontend/` (Next.js `output: standalone`).
- [ ] **8.3** Compose profile `node`: `docker compose --profile node up` chạy đủ postgres + flyway + BE + FE.
- [ ] **8.4** CI (GitHub Actions): lint, typecheck, test BE + FE trên mỗi push/PR.
- [ ] **8.5** Deploy (chốt nền tảng ở bước này), cấu hình proxy cho SSE (tắt buffering, timeout).
- [ ] **8.6** README hoàn chỉnh, ERD, sơ đồ kiến trúc, ảnh demo; đối chiếu và tick checklist MVP (mục 10).
  - **Checklist giai đoạn 8 = Checklist MVP (mục 10).**

### Giai đoạn 9 — Backend Spring Boot (chia nhỏ thêm khi bắt đầu)

- [ ] **9.1** Cấu hình `backend-spring/`: `application.yml`, kết nối DB chung, tắt Flyway nội bộ, `ddl-auto=validate`, health-check.
- [ ] **9.2** Format lỗi và mã lỗi giống contract (`@RestControllerAdvice`).
- [ ] **9.3** Entity + repository cho users, conversations, messages.
- [ ] **9.4** Spring Security: filter JWT từ cookie, BCrypt, endpoint auth.
  - Kiểm tra: user đăng ký ở backend Node đăng nhập được ở Spring.
- [ ] **9.5** CRUD hội thoại + lịch sử tin nhắn, kiểm tra sở hữu.
- [ ] **9.6** `AiClient` + gửi tin không stream.
- [ ] **9.7** SSE bằng `SseEmitter`, hủy giữa chừng, job dọn `PENDING`.
- [ ] **9.8** Rate limit (Bucket4j) + quota.
- [ ] **9.9** Test JUnit, Mockito, Testcontainers, WireMock.
- [ ] **9.10** Dockerfile + compose profile `spring`; Playwright chạy được với cả hai backend.
- [ ] **9.11** README so sánh hai backend (mục 11).
