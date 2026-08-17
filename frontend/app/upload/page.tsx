"use client";

import { useRef, useState } from "react";
import {
  FileScan,
  LoaderCircle,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { LogiLogo } from "@/components/logi-logo";
import { SiteNav } from "@/components/site-nav";
import { API_BASE, ApiResponse, AssistantMessage } from "@/components/hs/results";

type UploadEntry = {
  filename: string;
  previewUrl: string;
  response: ApiResponse | null;
};

export default function UploadPage() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitFile(file: File) {
    if (loading) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setEntries((e) => [
        { filename: file.name, previewUrl: "", response: { status: "error", message: "Chỉ hỗ trợ ảnh JPEG/PNG/WebP/GIF. PDF/Excel sẽ hỗ trợ ở phase sau." } },
        ...e,
      ]);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setEntries((e) => [{ filename: file.name, previewUrl, response: null }, ...e]);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/v1/search/file`, { method: "POST", body: form });
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        data.status = "error";
        data.message = (data as { detail?: string }).detail || data.message || "Upload thất bại.";
      }
      setEntries((e) => e.map((it, i) => (i === 0 ? { ...it, response: data } : it)));
    } catch {
      setEntries((e) =>
        e.map((it, i) =>
          i === 0
            ? { ...it, response: { status: "error", message: "Không kết nối được máy chủ LogiAI tại " + API_BASE } }
            : it,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClarify(requestId: string, answers: { question_id: string; answer: string }[]) {
    // Clarify trong context upload: gọi API rồi thay response entry đầu có request_id tương ứng
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/v1/search/clarify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, answers }),
        });
        const data: ApiResponse = await res.json();
        setEntries((e) => [{ filename: "Làm rõ thêm", previewUrl: "", response: data }, ...e]);
      } finally {
        setLoading(false);
      }
    })();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <LogiLogo />
          <SiteNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#fa5a1e]/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-[#c2410c]">
            <Sparkles className="size-3.5" aria-hidden />
            TRA CỨU MÃ HS TỪ CHỨNG TỪ
          </p>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Upload ảnh chứng từ hoặc sản phẩm
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty leading-7 text-slate-600">
            Invoice, Packing List, C/O, nhãn hàng hoặc ảnh sản phẩm — AI trích xuất từng mặt hàng,
            phân loại mã HS 8 số kèm biểu thuế và kiểm tra pháp lý tự động.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void submitFile(f);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void submitFile(f);
          }}
          className={`mt-8 grid w-full place-items-center rounded-3xl border-2 border-dashed px-6 py-14 transition ${
            dragOver
              ? "border-[#fa5a1e] bg-[#fff7f2]"
              : "border-slate-300 bg-white hover:border-[#fa5a1e]/50 hover:bg-[#fff7f2]/50"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-[#fff1e9]">
            {loading ? (
              <LoaderCircle className="size-6 animate-spin text-[#fa5a1e]" aria-hidden />
            ) : (
              <FileScan className="size-6 text-[#fa5a1e]" aria-hidden />
            )}
          </span>
          <span className="mt-4 text-sm font-semibold text-slate-900">
            {loading ? "Đang trích xuất & phân loại…" : "Kéo thả hoặc bấm để chọn ảnh"}
          </span>
          <span className="mt-1.5 text-xs text-slate-500">
            JPEG, PNG, WebP, GIF · tối đa 10MB
          </span>
        </button>

        <div className="mt-10 space-y-8">
          {entries.map((en, i) => (
            <section key={i} className="space-y-4">
              <div className="flex items-center gap-3">
                {en.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={en.previewUrl}
                    alt={en.filename}
                    className="size-12 rounded-xl border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded-xl bg-slate-100">
                    <Paperclip className="size-4 text-slate-500" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{en.filename}</p>
                  {en.response?.metadata?.search_time_ms != null && (
                    <p className="text-xs text-slate-400">
                      {(en.response.metadata.search_time_ms / 1000).toFixed(1)}s · dữ liệu{" "}
                      {en.response.metadata.data_version}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEntries((e) => e.filter((_, j) => j !== i))}
                  className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Xóa kết quả"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {en.response ? (
                <AssistantMessage response={en.response} disabled={loading} onClarify={handleClarify} />
              ) : (
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin text-[#fa5a1e]" aria-hidden />
                  Đang đọc chứng từ, trích xuất mặt hàng…
                </p>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
