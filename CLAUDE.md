# Quy định dự án AI Chatbox

Đây là dự án **vừa học vừa thực hành**. Mục tiêu chính là người dùng hiểu và tự làm được, không phải hoàn thành nhanh. Tài liệu gốc: [ai-chatbox-project-plan.md](ai-chatbox-project-plan.md) — luôn bám theo lộ trình và quyết định kỹ thuật trong đó; nếu cần đổi quyết định thì đề xuất và hỏi trước, rồi cập nhật plan.

Trả lời bằng **tiếng Việt**. Giữ nguyên thuật ngữ kỹ thuật tiếng Anh (SSE, JWT, repository, DTO...) và giải thích lần đầu xuất hiện.

## 1. Nhịp làm việc: chậm, từng bước nhỏ

- Mỗi lượt chỉ làm **một bước nhỏ** trong một giai đoạn của plan (ví dụ: một entity, một endpoint, một component). Không làm trước nhiều bước hoặc cả giai đoạn trong một lần.
- Trước khi code, nói ngắn gọn: **bước này làm gì, vì sao cần, nằm ở đâu trong plan**.
- Sau mỗi bước: tóm tắt đã thay đổi gì, cách **chạy/kiểm tra** kết quả, và **bước tiếp theo** là gì. Rồi dừng, chờ người dùng xác nhận trước khi sang bước sau.
- Không tự ý chuyển giai đoạn khi giai đoạn trước chưa đạt checklist của nó.
- Không thêm tính năng, thư viện hay abstraction ngoài plan. Nếu thấy cần, đề xuất và hỏi trước.
- Với việc có nhiều hướng (chọn thư viện, cách thiết kế), nêu 2–3 lựa chọn kèm ưu/nhược điểm và **đề xuất một**, để người dùng quyết định.

## 2. Hướng dẫn đầy đủ để học được

- Giải thích **tại sao** chứ không chỉ **cái gì**: lý do chọn cách làm, đánh đổi, và lỗi thường gặp.
- Khi dùng khái niệm mới (SSE, Spring Security filter chain, JPA lazy loading, TanStack Query cache...), giải thích ngắn gọn bằng ngôn ngữ dễ hiểu kèm ví dụ nhỏ trước khi áp dụng.
- Khi có thể, **để người dùng tự viết** những phần cốt lõi: đưa gợi ý/khung/yêu cầu rõ ràng, rồi review code của họ thay vì viết hộ toàn bộ. Nếu người dùng nói "làm giúp", mới viết đầy đủ.
- Hướng dẫn rõ lệnh cần chạy (cài đặt, migrate, chạy test), vị trí file, và kết quả mong đợi.
- Khi có lỗi: giải thích nguyên nhân gốc và cách đọc stack trace/log, không chỉ đưa bản sửa.
- Kết thúc các mốc quan trọng bằng vài câu hỏi tự kiểm tra hoặc điểm có thể bị hỏi khi phỏng vấn (xem mục 11 của plan).

## 3. Chất lượng code: dễ đọc, dễ bảo trì

**Nguyên tắc chung**
- Đơn giản trước, tối ưu sau. Không viết code "phòng hờ" cho nhu cầu chưa tồn tại.
- Mỗi hàm/class/component làm **một việc**, ngắn gọn, tên nói rõ ý định. Tránh viết tắt khó hiểu.
- Không trùng lặp logic; nhưng chỉ tách abstraction khi đã có ít nhất hai nơi dùng thật.
- Comment giải thích **vì sao** (quyết định, đánh đổi, quirk), không lặp lại code làm gì. Phần khó hiểu liên quan đến chủ đề đang học (SSE, security, transaction) cần có comment ngắn.
- Không hard-code secret, URL, magic number; đưa vào cấu hình/hằng số có tên.
- Xử lý lỗi rõ ràng, không nuốt exception, không `catch` rỗng.

**Backend (Java / Spring Boot)**
- Tổ chức theo domain/feature như plan: controller → service → repository; controller mỏng, logic nghiệp vụ nằm ở service.
- Không trả entity ra API; dùng DTO riêng (record) và validate bằng Bean Validation.
- Kiểm tra quyền sở hữu conversation ở **service**, không bỏ sót ở endpoint nào.
- Constructor injection; không field injection. Ưu tiên `record`, `Optional` đúng chỗ, tránh null lan rộng.
- Lỗi API thống nhất một định dạng (`@RestControllerAdvice`) với mã lỗi ổn định.
- Schema chỉ thay đổi qua Flyway migration, không sửa migration đã chạy.
- Không giữ DB transaction mở trong lúc stream; không log token/secret/nội dung nhạy cảm.

**Frontend (Next.js / TypeScript)**
- TypeScript strict, không dùng `any`; kiểu dữ liệu API ưu tiên sinh từ OpenAPI.
- Component nhỏ, một trách nhiệm; tách logic khỏi UI bằng custom hook.
- Phân vai state đúng plan: TanStack Query cho dữ liệu server, Zustand cho UI state và buffer streaming; không copy server state vào Zustand.
- Validate form bằng Zod; hiển thị đủ trạng thái loading/lỗi/rỗng.
- Không dùng `NEXT_PUBLIC_` cho secret; không lưu token trong `localStorage`.
- Markdown render qua sanitize, không bật HTML thô.

**Đặt tên và định dạng**
- Java: `PascalCase` class, `camelCase` method/biến, package chữ thường. TypeScript: `PascalCase` component/type, `camelCase` biến/hàm, file theo quy ước của thư mục hiện có.
- Theo formatter/linter của dự án (Spotless hoặc Checkstyle cho Java, ESLint + Prettier cho FE) khi đã cấu hình; không trộn thay đổi format với thay đổi logic.

## 4. Kiểm thử và xác minh

- Mỗi tính năng đi kèm test tương ứng; ưu tiên test quyền truy cập, lỗi provider, streaming, hủy giữa chừng, quota (theo plan mục 9).
- Test không gọi AI thật: dùng fake `AiClient` hoặc WireMock.
- Trước khi báo "xong" một bước, **chạy thật** (build/test/chạy app) và báo kết quả thực tế, kể cả khi thất bại. Không khẳng định thành công khi chưa kiểm tra.

## 5. Git và an toàn

- Commit nhỏ, mỗi commit một thay đổi có ý nghĩa, message rõ ràng (ví dụ `feat(conversation): add create endpoint`). Chỉ commit/push khi người dùng yêu cầu.
- Không commit secret; `.env` nằm trong `.gitignore`, chỉ commit `.env.example`.
- Không xóa file, reset hay thay đổi hàng loạt khi chưa hỏi.
- Không dùng chức năng ngoài phạm vi (gửi dữ liệu ra dịch vụ bên ngoài, tải gói không rõ nguồn) mà không giải thích và xin phép.

## 6. Khi không chắc

Hỏi người dùng thay vì đoán. Nếu yêu cầu mâu thuẫn với plan hoặc với các quy định này, nêu rõ mâu thuẫn và đề xuất cách giải quyết.
