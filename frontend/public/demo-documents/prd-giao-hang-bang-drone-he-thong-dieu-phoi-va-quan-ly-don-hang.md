# Drone Delivery AI — PRD demo cho SoatAI

> **Dữ kiện demo.** Bản Markdown này được chuyển thể để trình diễn AI Release Risk Review, dựa trên chủ đề của PDF PRD giao hàng bằng drone. Các thông số AI, control và giả định bên dưới chỉ dùng cho demo, không phải khẳng định về hệ thống trong PDF gốc.

## 1. Mục tiêu phát hành pilot

Drone Delivery AI hỗ trợ điều phối đơn giao hàng từ nhà hàng đến khách hàng bằng drone. Pilot dự kiến chạy tại một quận, tối đa 80 đơn/ngày. Sản phẩm dùng mô hình AI để xếp hạng drone khả dụng, đề xuất tuyến bay và dự đoán rủi ro pin hoặc thời tiết. Mục tiêu là giảm thời gian phân công, nhưng không thay thế quyền quyết định an toàn của điều phối viên.

Quyết định AI có thể ảnh hưởng trực tiếp đến khách hàng nhận hàng, nhân viên nhà hàng, điều phối viên và người đi đường trong vùng bay. Nếu tuyến hoặc drone được chọn sai, hậu quả có thể gồm giao nhầm, chậm giao, mất hàng, hạ cánh không an toàn hoặc xâm phạm riêng tư do dữ liệu vị trí.

## 2. Cách AI được sử dụng

- Hệ thống nhận thông tin đơn hàng, vị trí giao/nhận, trọng lượng, thời hạn giao, mức pin, trạng thái drone, vùng cấm bay và dữ liệu thời tiết.
- Mô hình xếp hạng các drone đủ điều kiện; mô hình dự báo rủi ro pin và thời tiết; bộ tối ưu tuyến đề xuất tuyến bay. Các model chỉ đưa ra đề xuất và điểm tin cậy.
- Drone Control Service chỉ gửi lệnh cất cánh sau khi điều phối viên xác nhận đề xuất trên dashboard. Không có lệnh bay hoặc quyết định hạ cánh nào được gửi trực tiếp từ mô hình ngôn ngữ.
- Nếu confidence thấp, dữ liệu thời tiết lỗi thời, GPS lệch quá 15 mét, pin dưới ngưỡng hoặc tuyến đi vào vùng cấm, hệ thống phải dừng tự động, không đề xuất chuyến bay và yêu cầu điều phối viên xử lý thủ công.

## 3. Con người chịu trách nhiệm và quyền can thiệp

Product Owner: Trưởng nhóm Vận hành Drone chịu trách nhiệm cuối cùng cho pilot, phê duyệt thay đổi model và tiếp nhận khiếu nại.

Điều phối viên tại Control Station kiểm tra đề xuất trước mỗi lần cất cánh. Họ có thể đổi drone, sửa tuyến, từ chối chuyến bay hoặc bấm nút dừng khẩn cấp trong suốt chuyến bay. Nút dừng khẩn cấp được kiểm thử trong diễn tập hằng tuần; sau khi dừng, drone chuyển sang chế độ hạ cánh an toàn hoặc quay về trạm theo quy tắc deterministic.

Khách hàng chỉ nhận thông báo trạng thái và thời gian dự kiến giao; không nhận điểm AI hay dữ liệu vị trí của drone khác. Nhân viên nhà hàng có thể báo sai đơn hoặc hủy trước khi drone cất cánh.

## 4. Dữ liệu, nhà cung cấp và bảo mật

Hệ thống xử lý tên người nhận, số điện thoại, địa chỉ giao hàng, tọa độ GPS giao/nhận, mã đơn, trạng thái thanh toán đã được token hoá, lịch sử giao hàng, telemetry drone và dữ liệu thời tiết công khai. Không thu thập dữ liệu sức khỏe, trẻ em, CCCD, ảnh khuôn mặt hoặc nội dung thanh toán thô.

Thông tin người nhận demo: Nguyễn Minh An, số điện thoại 0901 234 567. Đây là dữ liệu synthetic chỉ để kiểm tra lớp che PII của bản demo.

Tên, số điện thoại và địa chỉ được tách khỏi prompt AI; model chỉ nhận mã đơn giả danh, khu vực địa lý làm tròn 100 mét, trọng lượng và trạng thái kỹ thuật cần thiết. Dữ liệu truyền qua TLS, mã hóa khi lưu, giới hạn quyền theo vai trò, nhật ký truy cập, retention tối đa 30 ngày cho telemetry pilot và 90 ngày cho audit decision. Nhà cung cấp model là OpenAI API theo hợp đồng xử lý dữ liệu đã được bộ phận pháp chế xem xét; nhà cung cấp không được dùng dữ liệu gửi từ pilot để huấn luyện.

## 5. Đánh giá model, failure mode và fallback

Trước pilot, nhóm dùng dữ liệu mô phỏng và replay 500 đơn lịch sử đã được giả danh để đo tỷ lệ đề xuất sai drone, tuyến vi phạm vùng cấm, thiếu pin và cảnh báo thời tiết. Release gate là không có tuyến vi phạm vùng cấm trong bộ test bắt buộc, tỷ lệ đề xuất cần điều phối viên sửa dưới 10% và mọi đề xuất low-confidence phải bị chặn.

Các failure mode đã biết: dữ liệu GPS trễ, bản đồ vùng cấm cũ, thời tiết thay đổi nhanh, sensor pin sai, model suy luận sai do input thiếu, mất kết nối drone và hành vi người dùng cố tình nhập địa chỉ không hợp lệ. Fallback là dashboard phân công thủ công, đường bay đã được phê duyệt trước, dừng chuyến và liên hệ khách hàng. Hiện chưa có quy trình chính thức đo bias theo khu vực thu nhập hoặc cơ chế thông báo chủ động cho khách hàng khi AI góp phần tạo ra chậm trễ.

## 6. Quy mô, chi phí và quan sát vận hành

Pilot dự kiến 2.000 đơn/tháng, ngân sách vận hành AI 12.000.000 VND/tháng và giá trị mục tiêu 25.000 VND cho mỗi đơn giao thành công. Chi phí dự kiến gồm dự báo/thứ hạng AI, bản đồ, telemetry và nhân sự điều phối. Dashboard ghi nhận đề xuất AI, người phê duyệt hoặc từ chối, lý do override, kết quả giao và incident ID.

Vận hành theo dõi tỷ lệ override, chuyến bay bị chặn, giao thất bại, near-miss an toàn, chi phí/đơn và khiếu nại. Nếu một ngưỡng an toàn bị vượt, Product Owner phải tạm dừng pilot, đánh giá lại model và chỉ mở lại sau khi có bằng chứng khắc phục.

## 7. Các điểm còn thiếu cần review

Trước khi mở rộng ngoài pilot, đội cần hoàn tất đánh giá tác động quyền riêng tư cho dữ liệu vị trí, cơ chế giải thích/kháng nghị khi khách hàng bị từ chối giao, kiểm thử sự cố kết nối thực địa và danh mục escalation khi điều phối viên không phản hồi đúng SLA.
