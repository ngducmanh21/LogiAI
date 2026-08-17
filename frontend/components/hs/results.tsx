"use client";

import { useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  CircleAlert,
  Landmark,
  MessageCircleQuestion,
  Percent,
  ScanSearch,
  Send,
  ShieldCheck,
} from "lucide-react";

export const API_BASE = (process.env.NEXT_PUBLIC_LOGIAI_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// ---------------------------------------------------------------- Types (spec 03)

export type TaxInfo = {
  import_mfn?: string | null;
  import_ordinary?: string | null;
  import_preferential?: Record<string, string | null>;
  vat?: string | null;
  special_consumption_tax?: string | null;
  export?: string | null;
  environment_tax?: string | null;
};

export type LegalReference = {
  type?: string;
  number?: string;
  title?: string;
  relevant_section?: string;
};

export type HsNotes = {
  section?: string | null;
  chapter?: string | null;
  heading?: string | null;
  section_note?: string | null;
  chapter_note?: string | null;
};

export type SpecialConditions = {
  import_license_required?: boolean;
  specialized_inspection?: boolean;
  quarantine_required?: boolean;
  notes?: string | null;
};

export type HsResult = {
  hs_code: string;
  description_vi?: string | null;
  description_en?: string | null;
  unit?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  tax_info?: TaxInfo;
  legal_references?: LegalReference[];
  hs_notes?: HsNotes;
  special_conditions?: SpecialConditions;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  type: "single_choice" | "free_text";
  options?: string[];
  placeholder?: string;
};

export type Clarification = {
  message?: string;
  questions?: ClarificationQuestion[];
};

export type PartialResult = {
  hs_code: string;
  description_vi?: string | null;
  confidence?: number | null;
};

export type ExtractedItem = {
  description?: string;
  material?: string;
  quantity?: string;
  origin?: string;
  declared_hs?: string;
};

export type Extraction = {
  item: ExtractedItem;
  query: string;
  search: ApiResponse;
};

export type LegalCitation = {
  chunk_id?: string;
  doc?: string;
  article?: string;
  quote?: string;
  doc_title?: string;
};

export type LegalVerification = {
  status: "ok" | "conditional" | "restricted" | "unknown";
  summary?: string;
  requirements?: string[];
  citations?: LegalCitation[];
};

export type ApiResponse = {
  status: string;
  request_id?: string;
  message?: string;
  results?: HsResult[];
  result?: HsResult;
  partial_results?: PartialResult[];
  clarification?: Clarification;
  legal_verification?: LegalVerification | null;
  // file upload
  document_type?: string;
  note?: string;
  extractions?: Extraction[];
  metadata?: { search_time_ms?: number; data_version?: string; filename?: string };
};

// ---------------------------------------------------------------- Small pieces

export function confidenceBadge(c?: number | null) {
  if (c == null) return null;
  const pct = Math.round(c * 100);
  const tone =
    c >= 0.85
      ? "bg-emerald-50 text-emerald-700"
      : c >= 0.6
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{pct}%</span>
  );
}

function TaxGrid({ tax }: { tax?: TaxInfo }) {
  if (!tax) return null;
  const base: [string, string | null | undefined][] = [
    ["Thuế NK MFN", tax.import_mfn],
    ["NK thông thường", tax.import_ordinary],
    ["VAT", tax.vat],
    ["Thuế XK", tax.export],
    ["TTĐB", tax.special_consumption_tax],
    ["BVMT", tax.environment_tax],
  ];
  const ftas = Object.entries(tax.import_preferential || {}).filter(([, v]) => v != null && v !== "");
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {base
          .filter(([, v]) => v != null && v !== "")
          .map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
      </div>
      {ftas.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <Percent className="size-3.5" aria-hidden /> Ưu đãi FTA
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ftas.map(([fta, rate]) => (
              <span key={fta} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                <span className="font-semibold">{fta}</span>: {rate}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const VERIFY_UI: Record<string, { label: string; cls: string }> = {
  ok: { label: "Không thấy hạn chế XNK", cls: "bg-emerald-50 text-emerald-700" },
  conditional: { label: "Có điều kiện / giấy phép", cls: "bg-amber-50 text-amber-700" },
  restricted: { label: "Thuộc diện cấm / tạm ngừng", cls: "bg-red-50 text-red-700" },
  unknown: { label: "Chưa đủ căn cứ kết luận", cls: "bg-slate-100 text-slate-600" },
};

export function LegalVerificationCard({ v }: { v: LegalVerification }) {
  const ui = VERIFY_UI[v.status] || VERIFY_UI.unknown;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldCheck className="size-4 text-[#c2410c]" aria-hidden />
        Kiểm tra pháp lý tự động
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
      </p>
      {v.summary && <p className="mt-2.5 text-sm leading-6 text-slate-700">{v.summary}</p>}
      {(v.requirements || []).length > 0 && (
        <ul className="mt-3 space-y-1">
          {(v.requirements || []).map((r, i) => (
            <li key={i} className="text-sm leading-6 text-slate-700">
              <CircleAlert className="mr-1.5 inline size-3.5 text-amber-600" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      )}
      {(v.citations || []).length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <Landmark className="size-3.5" aria-hidden /> Căn cứ trích dẫn
          </p>
          <ul className="space-y-1.5">
            {(v.citations || []).map((c, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-800">
                  {c.doc} {c.article ? `— ${c.article}` : ""}
                </span>
                {c.doc_title && <span className="text-slate-400"> · {c.doc_title}</span>}
                {c.quote && <p className="mt-1 italic">“{c.quote}”</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ResultCard({ result, rank }: { result: HsResult; rank?: number }) {
  const [showNotes, setShowNotes] = useState(false);
  const notes = result.hs_notes;
  const legal = result.legal_references || [];
  const cond = result.special_conditions;
  const flags = [
    cond?.import_license_required && "Cần giấy phép nhập khẩu",
    cond?.specialized_inspection && "Kiểm tra chuyên ngành",
    cond?.quarantine_required && "Kiểm dịch",
  ].filter(Boolean) as string[];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2">
            {rank != null && (
              <span className="grid size-6 place-items-center rounded-full bg-slate-950 font-mono text-xs font-bold text-white">
                {rank}
              </span>
            )}
            <span className="font-mono text-2xl font-bold text-slate-900">{result.hs_code}</span>
            {confidenceBadge(result.confidence)}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{result.description_vi}</p>
          {result.description_en && (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">{result.description_en}</p>
          )}
        </div>
        {result.unit && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            ĐVT: {result.unit}
          </span>
        )}
      </div>

      {result.reasoning && (
        <p className="mt-4 rounded-xl border border-[#fa5a1e]/15 bg-[#fff7f2] p-3.5 text-sm leading-6 text-slate-700">
          <ScanSearch className="mr-1.5 inline size-4 text-[#c2410c]" aria-hidden />
          {result.reasoning}
        </p>
      )}

      <div className="mt-4">
        <TaxGrid tax={result.tax_info} />
      </div>

      {flags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <CircleAlert className="size-3.5" aria-hidden /> {f}
            </span>
          ))}
        </div>
      )}

      {legal.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <Landmark className="size-3.5" aria-hidden /> Căn cứ pháp lý
          </p>
          <ul className="space-y-1">
            {legal.map((ref, i) => (
              <li key={i} className="text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-800">{ref.type} {ref.number}</span>
                {ref.title ? ` — ${ref.title}` : ""}
                {ref.relevant_section ? ` (${ref.relevant_section})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(notes?.chapter || notes?.section || notes?.chapter_note) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#c2410c] hover:underline"
          >
            <BookOpen className="size-3.5" aria-hidden />
            {showNotes ? "Ẩn vị trí phân loại & chú giải" : "Xem vị trí phân loại & chú giải"}
          </button>
          {showNotes && (
            <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
              {notes?.section && <p><span className="font-semibold text-slate-800">Phần:</span> {notes.section}</p>}
              {notes?.chapter && <p><span className="font-semibold text-slate-800">Chương:</span> {notes.chapter}</p>}
              {notes?.heading && <p><span className="font-semibold text-slate-800">Nhóm:</span> {notes.heading}</p>}
              {notes?.chapter_note && (
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3">
                  {notes.chapter_note}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- Clarification form

export function ClarificationCard({
  clarification,
  partial,
  disabled,
  onSubmit,
}: {
  clarification: Clarification;
  partial?: PartialResult[];
  disabled: boolean;
  onSubmit: (answers: { question_id: string; answer: string }[]) => void;
}) {
  const questions = clarification.questions || [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const ready = questions.every((q) => (answers[q.id] || "").trim() !== "");

  return (
    <div className="rounded-2xl border border-[#fa5a1e]/25 bg-[#fff7f2] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#c2410c]">
        <MessageCircleQuestion className="size-4" aria-hidden />
        Cần làm rõ thêm
      </p>
      {clarification.message && (
        <p className="mt-2 text-sm leading-6 text-slate-700">{clarification.message}</p>
      )}

      {partial && partial.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {partial.map((p) => (
            <span key={p.hs_code} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700">
              {p.hs_code}
              {p.confidence != null && <span className="ml-1 text-slate-400">{Math.round(p.confidence * 100)}%</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-slate-900">{q.question}</p>
            {q.type === "single_choice" && q.options ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={disabled || submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-[#fa5a1e] bg-[#fa5a1e] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-[#fa5a1e]/50"
                      } disabled:opacity-60`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                disabled={disabled || submitted}
                placeholder={q.placeholder || "Nhập câu trả lời…"}
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-[#fa5a1e] disabled:opacity-60"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || submitted || !ready}
        onClick={() => {
          setSubmitted(true);
          onSubmit(questions.map((q) => ({ question_id: q.id, answer: answers[q.id] })));
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitted ? "Đã gửi" : "Gửi câu trả lời"}
        <Send className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Assistant message

export function AssistantMessage({
  response,
  disabled,
  onClarify,
}: {
  response: ApiResponse;
  disabled: boolean;
  onClarify: (requestId: string, answers: { question_id: string; answer: string }[]) => void;
}) {
  if (response.status === "needs_clarification" && response.clarification) {
    return (
      <ClarificationCard
        clarification={response.clarification}
        partial={response.partial_results}
        disabled={disabled}
        onSubmit={(answers) => onClarify(response.request_id || "", answers)}
      />
    );
  }

  if (response.status === "success" && response.extractions) {
    return (
      <div className="space-y-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <BadgeCheck className="size-4" aria-hidden />
          Đã trích xuất {response.extractions.length} mặt hàng từ chứng từ
          {response.document_type && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {response.document_type}
            </span>
          )}
        </p>
        {response.note && <p className="text-xs text-slate-500">{response.note}</p>}
        {response.extractions.map((ex, i) => (
          <div key={i} className="space-y-3">
            <div className="rounded-2xl border border-[#fa5a1e]/20 bg-[#fff7f2] p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-900">
                Mặt hàng {i + 1}: {ex.item.description}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                {ex.item.material && <span className="rounded-full bg-white px-2.5 py-1">Chất liệu: {ex.item.material}</span>}
                {ex.item.quantity && <span className="rounded-full bg-white px-2.5 py-1">SL: {ex.item.quantity}</span>}
                {ex.item.origin && <span className="rounded-full bg-white px-2.5 py-1">Xuất xứ: {ex.item.origin}</span>}
                {ex.item.declared_hs && (
                  <span className="rounded-full bg-white px-2.5 py-1 font-mono">HS khai báo: {ex.item.declared_hs}</span>
                )}
              </div>
            </div>
            <AssistantMessage response={ex.search} disabled={disabled} onClarify={onClarify} />
          </div>
        ))}
        <p className="text-xs text-slate-400">
          Kết quả mang tính tham khảo, không thay thế xác định mã số chính thức của cơ quan hải quan.
        </p>
      </div>
    );
  }

  if (response.status === "success") {
    const results = response.results || (response.result ? [response.result] : []);
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <BadgeCheck className="size-4" aria-hidden />
          {results.length > 1 ? `${results.length} mã HS phù hợp nhất` : "Kết quả phân loại"}
          {response.metadata?.search_time_ms != null && (
            <span className="font-normal text-slate-400">
              · {(response.metadata.search_time_ms / 1000).toFixed(1)}s · dữ liệu {response.metadata.data_version}
            </span>
          )}
        </p>
        {results.map((r, i) => (
          <ResultCard key={r.hs_code + i} result={r} rank={results.length > 1 ? i + 1 : undefined} />
        ))}
        {response.legal_verification && <LegalVerificationCard v={response.legal_verification} />}
        <p className="text-xs text-slate-400">
          Kết quả mang tính tham khảo, không thay thế xác định mã số chính thức của cơ quan hải quan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
      <CircleAlert className="mr-1.5 inline size-4 text-amber-600" aria-hidden />
      {response.message || "Không tìm thấy kết quả phù hợp."}
    </div>
  );
}
