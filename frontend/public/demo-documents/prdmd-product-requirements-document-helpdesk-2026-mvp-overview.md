# Helpdesk 2026 MVP — AI Release Risk Review demo

> **Dữ kiện demo.** Bản Markdown này được chuyển thể để trình diễn AI Release Risk Review, dựa trên chủ đề của PDF Helpdesk 2026 MVP. Các thông số AI, control và giả định bên dưới chỉ dùng cho demo, không phải khẳng định về hệ thống trong PDF gốc.

## 1. Mục tiêu sản phẩm và phạm vi phát hành

Helpdesk 2026 là hệ thống hỗ trợ đội chăm sóc khách hàng xử lý ticket của doanh nghiệp nhỏ. Trong pilot 8 tuần, AI phân loại chủ đề, dự đoán mức ưu tiên, tóm tắt hội thoại và soạn câu trả lời nháp bằng tiếng Việt. Mục tiêu là giảm thời gian phản hồi đầu tiên, không phải tự động đóng ticket hay tự đưa ra cam kết với khách hàng.

Người chịu ảnh hưởng là khách hàng gửi yêu cầu, nhân viên hỗ trợ, quản lý trực ca và bộ phận bảo mật của khách hàng doanh nghiệp. Một phân loại hoặc câu trả lời sai có thể làm chậm xử lý sự cố, tiết lộ thông tin nhạy cảm, phân biệt đối xử theo ngôn ngữ hoặc khiến khách hàng tin rằng đã nhận được tư vấn chính thức.

## 2. Hành vi AI và giới hạn tự động hóa

- AI nhận ticket đã được che dữ liệu nhạy cảm để phân loại thành thanh toán, kỹ thuật, tài khoản, khiếu nại hoặc khác; đề xuất priority; tóm tắt; và tạo bản nháp trả lời.
- Nhân viên hỗ trợ phải xem, sửa hoặc bỏ bản nháp trước khi gửi. Nút gửi chỉ khả dụng sau hành động xác nhận của con người; AI không tự gửi email, không thay đổi dữ liệu khách hàng và không đóng ticket.
- Ticket có cụm từ khẩn cấp, an ninh, pháp lý, hoàn tiền lớn hoặc confidence dưới 0,75 được đưa vào hàng chờ ưu tiên để quản lý trực ca xử lý. Trong các trường hợp này AI chỉ tóm tắt, không đề xuất câu trả lời.
- Product Owner là Head of Customer Experience. Quản lý trực ca có quyền override priority, ẩn câu trả lời AI, gán lại ticket và dừng AI cho một tenant bất cứ lúc nào.

## 3. Dữ liệu, quyền riêng tư và bảo mật

Ticket có thể chứa tên, email, số điện thoại, mã khách hàng, lịch sử đơn hàng, ảnh chụp lỗi và nội dung trao đổi. Trước provider call, service mask email, số điện thoại, mã định danh và token truy cập; ticket phát hiện dữ liệu sức khỏe, trẻ em, CCCD, mật khẩu hoặc khóa API bị chặn khỏi AI và chuyển nhân viên xử lý thủ công.

Model chỉ nhận nội dung đã mask, loại sản phẩm và ngữ cảnh ticket tối thiểu. Dữ liệu truyền TLS, được mã hóa khi lưu; truy cập dùng RBAC theo tenant; audit log ghi nhân viên đã xem/sửa/gửi draft; retention nội dung AI là 30 ngày và audit decision là 90 ngày. OpenAI API là provider cho pilot; dữ liệu không được sử dụng để huấn luyện theo cấu hình tài khoản doanh nghiệp. Không có service-role key trong browser.

## 4. Độ tin cậy, kiểm thử và fallback

Nhóm đã chuẩn bị 800 ticket giả danh từ năm nhóm chủ đề để đánh giá intent, priority và chất lượng draft. Gate pilot: 100% ticket khẩn cấp phải được route sang người; không được trả lời có cam kết hoàn tiền, tư vấn pháp lý/y tế hoặc tiết lộ dữ liệu từ ticket khác; tỷ lệ nhân viên chấp nhận draft sau chỉnh sửa được theo dõi nhưng không dùng làm chỉ số chất lượng duy nhất.

Failure mode cần theo dõi gồm hallucination, nhầm ticket, instruction injection trong nội dung khách hàng, language mismatch, bỏ sót urgency, lộ PII qua bản tóm tắt, provider outage và cost spike. Fallback là phân loại rule-based, mẫu trả lời đã phê duyệt, tìm kiếm knowledge base thủ công và tắt AI theo tenant. Nhân viên có nút báo sai và quản lý trực ca xem danh sách incident mỗi ngày.

## 5. Khả năng giải thích, công bằng và escalation

Giao diện hiển thị nhãn “AI đề xuất”, confidence, nguồn knowledge base nếu có và lý do route ở mức ngắn gọn. Khách hàng không thấy điểm ưu tiên nội bộ. Khi khách hàng phản đối hoặc một ticket bị phân loại sai nghiêm trọng, nhân viên có thể đánh dấu escalation; quản lý trực ca phải phản hồi trong 4 giờ làm việc.

Đội sẽ theo dõi chênh lệch error rate theo ngôn ngữ (Việt/Anh), loại khách hàng và nhóm chủ đề. Hiện chưa có tập đánh giá đầy đủ cho phương ngữ miền Trung/miền Nam và chưa xác định quy trình thông báo cho khách hàng khi ticket quan trọng bị trễ do priority AI sai.

## 6. Quy mô và kinh tế vận hành

Pilot dự kiến 6.000 ticket/tháng, trung bình 1.200 token đầu vào và 350 token đầu ra/ticket. Ngân sách AI là 18.000.000 VND/tháng; giá trị mục tiêu là giảm 3 phút xử lý cho mỗi ticket được nhân viên xác nhận hữu ích. Dashboard theo dõi chi phí/ticket, cost/successful-draft, tỷ lệ override, tỷ lệ escalation, thời gian phản hồi đầu tiên, incident và provider error.

## 7. Điều kiện trước khi mở rộng

Trước khi bật cho toàn bộ tenant, đội cần hoàn tất thỏa thuận xử lý dữ liệu cho từng khách hàng doanh nghiệp, kiểm thử red-team prompt injection, xác nhận owner của quy trình khiếu nại ngoài giờ và đánh giá phương ngữ còn thiếu. Quyết định phát hành cuối cùng thuộc Head of Customer Experience và CTO, không thuộc AI.
