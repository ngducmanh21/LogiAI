import Link from "next/link";
import { LogiLogo } from "../logi-logo";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleAlert,
  FileScan,
  Landmark,
  ListTree,
  MessageCircleQuestion,
  Percent,
  ScanSearch,
  Search,
  Ship,
  Sparkles,
  SplitSquareHorizontal,
} from "lucide-react";

const agents = [
  {
    icon: SplitSquareHorizontal,
    title: "Router Agent",
    description: "Phân loại đầu vào: mô tả hàng hóa, chứng từ upload hay mã HS trực tiếp.",
  },
  {
    icon: FileScan,
    title: "Document Extraction",
    description: "OCR và trích xuất mô tả hàng hóa từ Invoice, Packing List, ảnh chứng từ.",
  },
  {
    icon: ScanSearch,
    title: "HS Classifier",
    description: "Hybrid RAG: semantic + keyword trên 12.000 mã HS, suy luận theo chú giải.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Clarification Agent",
    description: "Kết quả mơ hồ? Tự động hỏi thêm chất liệu, công dụng để thu hẹp mã.",
  },
  {
    icon: Landmark,
    title: "Tax & Legal Agent",
    description: "Tra thuế MFN, VAT, ưu đãi FTA cùng thông tư, nghị định liên quan.",
  },
];

const steps = [
  {
    number: "01",
    title: "Mô tả hàng hóa",
    description: "Nhập mô tả bằng tiếng Việt, dán mã HS, hoặc upload chứng từ XNK.",
  },
  {
    number: "02",
    title: "AI phân tích & truy xuất",
    description: "Hệ thống multi-agent tìm kiếm hybrid trên biểu thuế và chú giải HS 2022.",
  },
  {
    number: "03",
    title: "Làm rõ khi cần",
    description: "Nếu nhiều mã phù hợp, AI hỏi thêm về chất liệu, công dụng, quy cách.",
  },
  {
    number: "04",
    title: "Nhận mã HS + biểu thuế",
    description: "Mã HS 8 số kèm thuế nhập khẩu, VAT, ưu đãi FTA và căn cứ pháp lý.",
  },
];

const painPoints = [
  {
    title: "Tra cứu thủ công mất hàng giờ",
    description: "Biểu thuế hơn 12.000 dòng, chú giải hàng nghìn trang — tìm đúng mã không dễ.",
  },
  {
    title: "Sai mã HS là sai thuế",
    description: "Áp sai mã dẫn đến truy thu, phạt chậm nộp và ách tắc thông quan.",
  },
  {
    title: "FTA nhiều nhưng khó tận dụng",
    description: "Mỗi hiệp định một biểu ưu đãi riêng — dễ bỏ lỡ mức thuế thấp hơn.",
  },
];

const features = [
  {
    icon: Search,
    title: "Tìm bằng mô tả",
    description: "Nhập mô tả hàng hóa tự nhiên, nhận mã HS gợi ý kèm độ tin cậy.",
  },
  {
    icon: FileScan,
    title: "Upload chứng từ",
    description: "Invoice, Packing List hoặc ảnh — OCR trích xuất rồi tra mã tự động.",
  },
  {
    icon: ListTree,
    title: "Tra trực tiếp mã HS",
    description: "Nhập mã 4–8 số, xem cây phân loại Phần → Chương → Nhóm → Mã.",
  },
  {
    icon: Percent,
    title: "Biểu thuế đầy đủ",
    description: "Thuế NK ưu đãi, VAT, và các mức FTA: ATIGA, CPTPP, EVFTA, RCEP…",
  },
];

const faqs = [
  {
    question: "Kết quả của LogiAI có thay thế tư vấn hải quan chính thức không?",
    answer:
      "Không. LogiAI đưa ra gợi ý phân loại kèm căn cứ và độ tin cậy. Việc áp mã chính thức thuộc thẩm quyền cơ quan hải quan; với hàng hóa phức tạp nên xin xác định trước mã số.",
  },
  {
    question: "Dữ liệu biểu thuế lấy từ đâu và có cập nhật không?",
    answer:
      "Dữ liệu được xử lý từ Biểu thuế XNK 2026 và Chú giải HS 2022 toàn tập, chuẩn hóa thành hơn 12.000 mã HS 8 số kèm các mức thuế MFN, VAT và FTA.",
  },
  {
    question: "Khi mô tả hàng hóa chưa đủ rõ thì sao?",
    answer:
      "Hệ thống không đoán bừa. Clarification Agent sẽ hỏi thêm về chất liệu, công dụng, quy cách — đúng những yếu tố quyết định mã HS — rồi mới kết luận.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="mb-4 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#c2410c] uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-[#fa5a1e]" />
        {eyebrow}
      </p>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#faf9f6] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
          <LogiLogo />
          <nav aria-label="Điều hướng landing page" className="hidden items-center gap-1 md:flex">
            <a href="#how-it-works" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
              Cách hoạt động
            </a>
            <a href="#features" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
              Tính năng
            </a>
            <a href="#agents" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
              Multi-Agent
            </a>
            <a href="#faq" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950">
              Câu hỏi thường gặp
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="#how-it-works" className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 md:hidden">
              Khám phá
            </a>
            <Link
              href="/legal"
              className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 sm:inline-flex"
            >
              Văn bản luật
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Tra cứu ngay
              <span className="grid size-7 place-items-center rounded-full bg-[#fa5a1e]">
                <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate border-b border-slate-200/80 px-5 pb-20 pt-16 sm:px-7 sm:pt-24 lg:px-10 lg:pb-28">
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,_rgba(250,90,30,0.16),_transparent_68%)]" />
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#fa5a1e]/20 bg-white/80 px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-[#c2410c] shadow-sm sm:text-xs">
                <Sparkles className="size-3.5" aria-hidden />
                TRA CỨU HS CODE & BIỂU THUẾ XNK BẰNG AI
              </p>
              <h1 className="mt-7 text-balance text-4xl font-semibold tracking-[-0.065em] text-slate-950 sm:text-6xl lg:text-7xl">
                Từ mô tả hàng hóa
                <span className="block text-[#fa5a1e]">đến mã HS trong vài giây.</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-xl sm:leading-8">
                LogiAI dùng Multi-Agent RAG trên hơn 12.000 mã HS của Biểu thuế XNK 2026 và Chú giải HS 2022 để phân loại hàng hóa, tra thuế MFN, VAT và ưu đãi FTA — kèm căn cứ rõ ràng.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/chat"
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Tra cứu mã HS ngay
                  <span className="grid size-8 place-items-center rounded-full bg-[#fa5a1e] transition-transform group-hover:rotate-45">
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Upload chứng từ
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/legal"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Văn bản luật
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Gợi ý phân loại kèm căn cứ — không thay thế xác định mã số chính thức của hải quan.
              </p>
            </div>

            <div className="relative mx-auto mt-14 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/10 sm:p-5">
              <div className="overflow-hidden rounded-[1.45rem] border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#fa5a1e]" />
                  <span className="size-2.5 rounded-full bg-amber-300" />
                  <span className="size-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-medium text-slate-500">Kết quả phân loại · bản xem trước</span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Mã HS đề xuất</p>
                        <p className="mt-2 inline-flex items-center gap-2 font-mono text-2xl font-bold text-slate-900">
                          5407.52.00
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">99%</span>
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Vải dệt thoi từ sợi filament tổng hợp, ≥85% polyester dún, đã nhuộm
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">minh hoạ</span>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {[
                        ["Thuế NK MFN", "12%"],
                        ["VAT", "8%"],
                        ["ATIGA", "0%"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[11px] font-medium text-slate-500">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-xl border border-[#fa5a1e]/20 bg-[#fff3eb] p-4 text-sm leading-6 text-slate-700">
                      <CircleAlert className="mr-1.5 inline size-4 text-[#c2410c]" aria-hidden />
                      AI đã hỏi thêm về dạng sợi và tỷ lệ pha trước khi kết luận — không đoán khi thông tin chưa đủ.
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-5 text-white">
                    <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">5 agent phối hợp</p>
                    <ul className="mt-4 space-y-3">
                      {agents.map((agent) => {
                        const Icon = agent.icon;
                        return (
                          <li key={agent.title} className="flex items-center gap-3 text-sm text-slate-200">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[#ff8c5f]">
                              <Icon className="size-3.5" aria-hidden />
                            </span>
                            {agent.title}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
              <p className="px-2 pt-3 text-center text-xs text-slate-500">
                Minh hoạ bố cục kết quả, số liệu thuế thực tế phụ thuộc mã HS và hiệp định áp dụng.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-5 py-20 sm:px-7 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <SectionHeading
              eyebrow="Vì sao cần LogiAI"
              title="Áp sai mã HS, trả giá bằng tiền và thời gian."
              description="Doanh nghiệp XNK phải đối mặt với biểu thuế hàng vạn dòng, chú giải phức tạp và hàng chục hiệp định FTA. LogiAI gom tất cả vào một lần tra cứu có căn cứ."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {painPoints.map((point, index) => (
                <article key={point.title} className="rounded-2xl border border-slate-200 bg-[#faf9f6] p-5">
                  <span className="font-mono text-sm font-semibold text-[#c2410c]">0{index + 1}</span>
                  <h3 className="mt-6 text-base font-semibold leading-6 text-slate-900">{point.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{point.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-7 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Một luồng, bốn bước"
              title="Từ mô tả hàng hóa đến biểu thuế đầy đủ."
              description="Không cần biết trước chương, nhóm hay quy tắc phân loại. Mô tả hàng hóa như bạn vẫn nói với đồng nghiệp — AI lo phần còn lại."
            />
            <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <li key={step.number} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="font-mono text-sm font-semibold text-[#c2410c]">{step.number}</span>
                  <h3 className="mt-8 text-xl font-semibold tracking-tight text-slate-900">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{step.description}</p>
                  <ChevronRight className="mt-7 size-5 text-[#fa5a1e]" aria-hidden />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-y border-slate-200 bg-white px-5 py-20 sm:px-7 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Tính năng chính"
              title="Bốn cách tra cứu, một nguồn dữ liệu chuẩn hóa."
              description="Hơn 12.000 mã HS 8 số kèm mô tả song ngữ, thuế suất MFN, VAT và các biểu ưu đãi FTA — được chuẩn hóa từ Biểu thuế XNK 2026 và Chú giải HS 2022."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="group rounded-2xl border border-slate-200 bg-[#faf9f6] p-5 transition hover:-translate-y-1 hover:border-[#fa5a1e]/35 hover:shadow-lg hover:shadow-[#fa5a1e]/5">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#fff1eb] text-[#c2410c]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-6 text-base font-semibold leading-6 text-slate-900">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="agents" className="scroll-mt-20 px-5 py-20 sm:px-7 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-slate-950 px-5 py-8 text-white sm:gap-12 sm:px-10 sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-14 lg:py-14">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#ff8c5f] uppercase">Kiến trúc Multi-Agent RAG</p>
              <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Năm agent chuyên trách, một kết luận có căn cứ.
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-300">
                Mỗi agent đảm nhận một việc: định tuyến, trích xuất chứng từ, phân loại hybrid RAG, hỏi làm rõ và tra thuế. Kết quả cuối cùng luôn kèm mã HS, độ tin cậy và căn cứ pháp lý.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                <Bot className="size-3.5 text-[#ff8c5f]" aria-hidden />
                Hybrid search: semantic + keyword trên 12.000 mã HS
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <div key={agent.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Icon className="size-5 text-[#ff8c5f]" aria-hidden />
                    <h3 className="mt-4 font-semibold">{agent.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{agent.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 px-5 py-20 sm:px-7 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <SectionHeading
              eyebrow="Câu hỏi thường gặp"
              title="Minh bạch về phạm vi và giới hạn."
              description="LogiAI là công cụ hỗ trợ tra cứu và phân loại ban đầu — quyết định áp mã cuối cùng vẫn thuộc về doanh nghiệp và cơ quan hải quan."
            />
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900 marker:hidden">
                    {faq.question}
                    <ChevronRight className="size-5 shrink-0 text-[#fa5a1e] transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="max-w-2xl pt-4 pr-8 leading-7 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-7 lg:px-10 lg:pb-28">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#fa5a1e]/20 bg-[#fff1eb] px-6 py-12 text-center sm:px-10 lg:py-16">
            <p className="text-xs font-bold tracking-[0.16em] text-[#c2410c] uppercase">
              <Ship className="mr-1.5 inline size-4" aria-hidden />
              Sẵn sàng cho lô hàng tiếp theo
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
              Mô tả hàng hóa của bạn, nhận mã HS ngay bây giờ.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-600">
              Bắt đầu với một mô tả đơn giản — AI sẽ hỏi thêm nếu cần và trả về mã HS kèm biểu thuế đầy đủ.
            </p>
            <Link href="/chat" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800">
              Tra cứu mã HS ngay
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm sm:flex-row sm:items-center">
          <LogiLogo />
          <p className="max-w-xl text-slate-500 sm:text-right">
            LogiAI hỗ trợ tra cứu mã HS và biểu thuế XNK bằng AI; kết quả mang tính tham khảo, không thay thế xác định mã số chính thức của cơ quan hải quan.
          </p>
        </div>
      </footer>
    </div>
  );
}
