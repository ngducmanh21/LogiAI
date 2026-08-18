"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { History, Plus, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import { LogiLogo } from "@/components/logi-logo";
import { SiteNav } from "@/components/site-nav";
import { API_BASE, ApiResponse, AssistantMessage } from "@/components/hs/results";
import { AgentEvent, AgentFlow } from "@/components/hs/agent-flow";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; response: ApiResponse; flow?: AgentEvent[] };

type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const SESSIONS_KEY = "logiai_sessions";
const MAX_SESSIONS = 20;

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // localStorage đầy hoặc bị chặn — bỏ qua
  }
}

const EXAMPLES = [
  "Vải dệt thoi 100% polyester đã nhuộm, định lượng 120g/m2",
  "Cà phê rang xay Arabica đóng gói 500g",
  "8471.30.90",
  "Máy khoan cầm tay dùng pin 18V",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[] | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Khôi phục session gần nhất khi mở trang
  useEffect(() => {
    const stored = loadSessions();
    setSessions(stored);
    if (stored.length > 0) {
      setSessionId(stored[0].id);
      setMessages(stored[0].messages);
    } else {
      setSessionId(crypto.randomUUID());
    }
  }, []);

  // Tự động lưu mỗi khi messages thay đổi
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    setSessions((prev) => {
      const firstUser = messages.find((m) => m.role === "user");
      const title =
        firstUser && firstUser.role === "user"
          ? firstUser.text.slice(0, 60)
          : "Cuộc trò chuyện mới";
      const session: ChatSession = { id: sessionId, title, updatedAt: Date.now(), messages };
      const next = [session, ...prev.filter((s) => s.id !== sessionId)];
      saveSessions(next);
      return next;
    });
  }, [messages, sessionId]);

  function newSession() {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setShowHistory(false);
  }

  function openSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setSessionId(s.id);
    setMessages(s.messages);
    setShowHistory(false);
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
    if (id === sessionId) {
      setSessionId(crypto.randomUUID());
      setMessages([]);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, liveEvents]);

  async function callApi(path: string, body: unknown) {
    setLoading(true);
    setLiveEvents([]);
    const events: AgentEvent[] = [];
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result: ApiResponse | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "agent") {
            events.push(evt as AgentEvent);
            setLiveEvents([...events]);
          } else if (evt.type === "result") {
            result = evt.data as ApiResponse;
          }
        }
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          response: result ?? { status: "error", message: "Không nhận được kết quả từ máy chủ." },
          flow: events,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          response: {
            status: "error",
            message: "Không kết nối được máy chủ LogiAI. Kiểm tra backend đang chạy tại " + API_BASE,
          },
          flow: events,
        },
      ]);
    } finally {
      setLoading(false);
      setLiveEvents(null);
    }
  }

  function submitQuery(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setMessages((m) => [...m, { role: "user", text: query }]);
    setInput("");
    void callApi("/v1/search/text/stream", { query });
  }

  function handleClarify(requestId: string, answers: { question_id: string; answer: string }[]) {
    setMessages((m) => [
      ...m,
      { role: "user", text: answers.map((a) => a.answer).join(" · ") },
    ]);
    void callApi("/v1/search/clarify/stream", { request_id: requestId, answers });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuery(input);
  }

  const lastIndex = messages.length - 1;

  const sidebarContent = (
    <>
      <button
        type="button"
        onClick={newSession}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#fa5a1e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#e04d14]"
      >
        <Plus className="size-4" aria-hidden />
        Phiên mới
      </button>
      <p className="mt-5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <History className="size-3.5" aria-hidden />
        Lịch sử ({sessions.length})
      </p>
      {sessions.length === 0 ? (
        <p className="px-1 py-3 text-sm text-slate-500">Chưa có phiên nào được lưu.</p>
      ) : (
        <ul className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openSession(s.id)}
                className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-slate-100 ${
                  s.id === sessionId ? "bg-orange-50 text-[#c2410c]" : "text-slate-700"
                }`}
              >
                <span className="block truncate">{s.title}</span>
                <span className="block text-xs text-slate-400">
                  {new Date(s.updatedAt).toLocaleString("vi-VN")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => deleteSession(s.id)}
                className="rounded-full p-1.5 text-slate-400 transition hover:text-red-600"
                aria-label="Xoá phiên"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#fa5a1e]/40 lg:hidden"
              aria-label="Lịch sử phiên"
            >
              <History className="size-3.5" aria-hidden />
              Lịch sử
            </button>
            <LogiLogo />
          </div>
          <SiteNav />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar dọc bên trái (desktop) */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/60 p-3 lg:flex">
          {sidebarContent}
        </aside>

        {/* Drawer mobile */}
        {showHistory && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/30"
              onClick={() => setShowHistory(false)}
              aria-label="Đóng lịch sử"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-3 shadow-xl">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-700"
                  aria-label="Đóng"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#fa5a1e]/20 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-[#c2410c]">
              <Sparkles className="size-3.5" aria-hidden />
              TRA CỨU MÃ HS & BIỂU THUẾ XNK
            </p>
            <h1 className="mt-6 max-w-xl text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Mô tả hàng hóa hoặc nhập mã HS
            </h1>
            <p className="mt-4 max-w-lg text-pretty leading-7 text-slate-600">
              AI phân loại trên hơn 12.000 mã HS của Biểu thuế XNK 2026 — trả về mã 8 số kèm thuế
              MFN, VAT, ưu đãi FTA. Sub-agent pháp lý tự động đối chiếu quy định XNK liên quan.
            </p>
            <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => submitQuery(ex)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-[#fa5a1e]/40 hover:shadow-sm"
                >
                  <Search className="mr-2 inline size-3.5 text-[#c2410c]" aria-hidden />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 py-8">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-2.5 text-sm leading-6 text-white">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="max-w-[95%] space-y-3">
                  {m.flow && m.flow.length > 0 && <AgentFlow events={m.flow} finished />}
                  <AssistantMessage
                    response={m.response}
                    disabled={loading || i !== lastIndex}
                    onClarify={handleClarify}
                  />
                </div>
              ),
            )}
            {loading && liveEvents !== null && (
              <div className="max-w-[95%]">
                <AgentFlow events={liveEvents} finished={false} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
          </main>

          <div className="sticky bottom-0 border-t border-slate-200/80 bg-[#faf9f6]/95 px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
            <form onSubmit={onSubmit} className="mx-auto flex max-w-4xl items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: vải dệt thoi 100% polyester đã nhuộm… hoặc 5407.52.00"
            className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#fa5a1e] sm:px-5"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fa5a1e] text-white transition hover:bg-[#e04d14] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Gửi"
          >
            <Send className="size-4" aria-hidden />
          </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
