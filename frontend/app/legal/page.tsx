"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  CheckCircle2,
  CloudUpload,
  FileText,
  LoaderCircle,
  ScrollText,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { LogiLogo } from "@/components/logi-logo";
import { SiteNav } from "@/components/site-nav";
import { API_BASE } from "@/components/hs/results";

type LegalDoc = {
  doc_id: string;
  doc_title: string;
  source_file: string | null;
  chunks: number;
  articles: number;
  uploaded: boolean;
};

type Citation = {
  chunk_id?: string;
  doc_title?: string;
  source_file?: string;
  article?: string | number | null;
  quote?: string;
};

type AskResponse = {
  status: string;
  message?: string;
  answer?: string;
  compliance?: string | null;
  citations?: Citation[];
  caveats?: string[];
};

type QAItem = { question: string; response?: AskResponse };

type DocSection = {
  article: number | string | null;
  article_title: string | null;
  text: string;
};

type DocDetail = {
  doc_id: string;
  doc_title: string;
  chunks: number;
  sections: DocSection[];
};

const EXAMPLE_QUESTIONS = [
  "Hàng quá cảnh có phải nộp thuế nhập khẩu không?",
  "Điều kiện miễn thuế với hàng gia công xuất khẩu?",
  "Trị giá hải quan được xác định như thế nào?",
];

export default function LegalPage() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [docsLoading, setDocsLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const [qa, setQa] = useState<QAItem[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadDocs() {
    setDocsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/legal/documents`);
      const data = await res.json();
      setDocs(data.documents ?? []);
      setTotalChunks(data.total_chunks ?? 0);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocs();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qa, asking]);

  async function openDoc(docId: string) {
    setDetailLoading(docId);
    try {
      const res = await fetch(`${API_BASE}/v1/legal/documents/${encodeURIComponent(docId)}`);
      if (res.ok) setDetail(await res.json());
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(null);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/v1/legal/documents`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({
          ok: true,
          text: `Đã thêm "${file.name}" — ${data.chunks_added} đoạn được nạp vào knowledge base.`,
        });
        void loadDocs();
      } else {
        setUploadMsg({ ok: false, text: data.detail ?? "Upload thất bại." });
      }
    } catch {
      setUploadMsg({ ok: false, text: "Không kết nối được máy chủ LogiAI tại " + API_BASE });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function ask(q: string) {
    const question = q.trim();
    if (!question || asking) return;
    setInput("");
    setAsking(true);
    setQa((m) => [...m, { question }]);
    try {
      const res = await fetch(`${API_BASE}/v1/legal/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data: AskResponse = await res.json();
      setQa((m) => m.map((it, i) => (i === m.length - 1 ? { ...it, response: data } : it)));
    } catch {
      setQa((m) =>
        m.map((it, i) =>
          i === m.length - 1
            ? { ...it, response: { status: "error", message: "Không kết nối được máy chủ LogiAI." } }
            : it,
        ),
      );
    } finally {
      setAsking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <LogiLogo />
          <SiteNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#fa5a1e]/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-[#c2410c]">
          <ScrollText className="size-3.5" aria-hidden />
          KHO VĂN BẢN PHÁP LUẬT XNK
        </p>
        <h1 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          Văn bản luật &amp; Knowledge base
        </h1>
        <p className="mt-3 max-w-2xl text-pretty leading-7 text-slate-600">
          Các văn bản luật, nghị định, thông tư về xuất nhập khẩu đang được AI sử dụng để đối
          chiếu pháp lý. Tải thêm văn bản (PDF/DOCX) — hệ thống tự động tách theo Điều, nạp vào
          knowledge base và dùng ngay cho trả lời.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* Danh sách văn bản */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                <BookOpenText className="size-5 text-[#c2410c]" aria-hidden />
                Văn bản trong knowledge base
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {docs.length} văn bản · {totalChunks} đoạn
              </span>
            </div>

            {docsLoading ? (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin text-[#fa5a1e]" aria-hidden />
                Đang tải danh sách…
              </p>
            ) : docs.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">
                Chưa có văn bản nào. Kiểm tra backend đang chạy tại {API_BASE}.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {docs.map((d) => (
                  <li key={d.doc_id}>
                    <button
                      type="button"
                      onClick={() => void openDoc(d.doc_id)}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-slate-50"
                      title="Xem toàn văn"
                    >
                      {detailLoading === d.doc_id ? (
                        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-[#fa5a1e]" aria-hidden />
                      ) : (
                        <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 hover:text-[#c2410c]" title={d.doc_title}>
                          {d.doc_title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {d.doc_id}
                          {d.articles > 0 && <> · {d.articles} điều</>} · {d.chunks} đoạn
                          {d.uploaded && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              mới tải lên
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Upload */}
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-[#fa5a1e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e04d14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CloudUpload className="size-4" aria-hidden />
                )}
                {uploading ? "Đang xử lý & nạp vào knowledge base…" : "Tải lên văn bản luật (PDF/DOCX)"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Tối đa 30MB. Hệ thống tự tách theo &quot;Điều&quot;, đánh chỉ mục và cập nhật
                knowledge base ngay lập tức.
              </p>
              {uploadMsg && (
                <p
                  className={`mt-3 inline-flex items-center gap-1.5 text-sm ${
                    uploadMsg.ok ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {uploadMsg.ok ? (
                    <CheckCircle2 className="size-4" aria-hidden />
                  ) : (
                    <XCircle className="size-4" aria-hidden />
                  )}
                  {uploadMsg.text}
                </p>
              )}
            </div>
          </section>

          {/* Hỏi đáp pháp lý */}
          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold tracking-tight">Hỏi đáp &amp; đối chiếu quy định</h2>
            <p className="mt-1 text-sm text-slate-500">
              AI trả lời kèm trích dẫn Điều/văn bản để bạn đối chiếu.
            </p>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto" style={{ maxHeight: 480 }}>
              {qa.length === 0 && (
                <div className="space-y-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void ask(q)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:border-[#fa5a1e]/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {qa.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <p className="max-w-[90%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-2 text-sm leading-6 text-white">
                      {item.question}
                    </p>
                  </div>
                  {item.response &&
                    (item.response.status === "success" ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-6 text-slate-800">
                        <p className="whitespace-pre-wrap">{item.response.answer}</p>
                        {item.response.citations && item.response.citations.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-2">
                            <p className="text-xs font-semibold text-slate-500">Trích dẫn</p>
                            <ul className="mt-1 space-y-1">
                              {item.response.citations.map((c, j) => (
                                <li key={j} className="text-xs text-slate-600">
                                  <span className="font-medium text-[#c2410c]">
                                    {c.doc_title}
                                    {c.article ? ` — Điều ${c.article}` : ""}
                                  </span>
                                  {c.quote && <>: “{c.quote.slice(0, 180)}”</>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {item.response.caveats && item.response.caveats.length > 0 && (
                          <ul className="mt-2 list-disc pl-4 text-xs text-amber-700">
                            {item.response.caveats.map((c, j) => (
                              <li key={j}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {item.response.message ?? "Có lỗi xảy ra."}
                      </p>
                    ))}
                </div>
              ))}
              {asking && (
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin text-[#fa5a1e]" aria-hidden />
                  Đang tra cứu văn bản luật…
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Hỏi về quy định XNK, thuế, thủ tục hải quan…"
                className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#fa5a1e]"
              />
              <button
                type="submit"
                disabled={asking || !input.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fa5a1e] text-white transition hover:bg-[#e04d14] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Gửi"
              >
                <Send className="size-4" aria-hidden />
              </button>
            </form>
          </section>
        </div>
      </main>

      {/* Modal toàn văn */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-snug text-slate-900">
                  {detail.doc_title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {detail.doc_id} · {detail.chunks} đoạn · toàn văn
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detail.sections.map((s, i) => (
                <section key={i} className={i > 0 ? "mt-6" : ""}>
                  {s.article != null && (
                    <h4 className="text-sm font-semibold text-[#c2410c]">
                      Điều {s.article}
                      {s.article_title ? `. ${s.article_title}` : ""}
                    </h4>
                  )}
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {s.text}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
