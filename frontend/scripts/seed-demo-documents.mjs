import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const cacheDirectory = resolve(repositoryRoot, "backend", "documents", "seed_cache");
const outputDirectory = resolve(repositoryRoot, "frontend", "public", "demo-documents");

const droneDemo = String.raw`# Drone Delivery AI — PRD demo cho SoatAI

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
`;

const helpdeskDemo = String.raw`# Helpdesk 2026 MVP — AI Release Risk Review demo

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
`;

const documents = [
  {
    sourceHash: "856b13ea4d0e1e5d0b409f36d8c8625e5a0af8ddb3553e694a9e7d65b2824a27",
    outputName: "prd-giao-hang-bang-drone-he-thong-dieu-phoi-va-quan-ly-don-hang.md",
    markdownHash: "7402d269aa9f5568bd1606817dceeb0aa2570fd45b2d9af0cb0578b3eb3d8825",
    markdown: `${droneDemo.trim()}\n`,
  },
  {
    sourceHash: "64fb501b998f01ae6c369d9116d64d75a9af5b4914429d67aca26c4bf8a01aec",
    outputName: "prdmd-product-requirements-document-helpdesk-2026-mvp-overview.md",
    markdownHash: "2dafaf6e794ff7f8f94cf078232be81aa2cbaed370f77e7a18e328a23c6549cd",
    markdown: `${helpdeskDemo.trim()}\n`,
  },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

await mkdir(outputDirectory, { recursive: true });

for (const document of documents) {
  const sourcePath = resolve(cacheDirectory, `${document.sourceHash}.md`);
  const source = (await readFile(sourcePath, "utf8")).replace(/\r\n/g, "\n");

  if (sha256(source) !== document.markdownHash) {
    throw new Error(`Markdown seed verification failed: ${sourcePath}`);
  }

  const outputPath = resolve(outputDirectory, document.outputName);
  await writeFile(outputPath, document.markdown, "utf8");
  console.log(`Seeded AI demo ${document.outputName}`);
}
