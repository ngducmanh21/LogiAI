"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  FileSearch,
  LoaderCircle,
  MessageCircleQuestion,
  MessagesSquare,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";

export type AgentEvent = {
  agent: string;
  status: "running" | "done" | "skipped";
  detail: string;
  ts: number;
};

const AGENTS: {
  id: string;
  num: string;
  name: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}[] = [
  { id: "router", num: "01", name: "Bảo vệ & Định tuyến", sub: "Router / Guardrail", icon: ShieldCheck },
  { id: "classifier", num: "02", name: "Phân loại mã HS", sub: "HS Classifier · GRI 1-6", icon: FileSearch },
  { id: "clarify", num: "03", name: "Làm rõ thông tin", sub: "Clarification Agent", icon: MessageCircleQuestion },
  { id: "tax", num: "04", name: "Biểu thuế & FTA", sub: "Tax & Tariff Agent", icon: Calculator },
  { id: "legal", num: "05", name: "Đối chiếu pháp lý", sub: "Legal Verify · RAG", icon: BookOpenCheck },
];

type AgentState = "pending" | "running" | "done" | "skipped";

function agentStates(events: AgentEvent[], finished: boolean): Record<string, AgentState> {
  const st: Record<string, AgentState> = {};
  for (const a of AGENTS) st[a.id] = "pending";
  for (const e of events) {
    if (st[e.agent] !== undefined)
      st[e.agent] = e.status === "done" ? "done" : e.status === "skipped" ? "skipped" : "running";
  }
  if (finished) {
    for (const a of AGENTS) if (st[a.id] !== "done") st[a.id] = "skipped";
  }
  return st;
}

export function AgentFlow({ events, finished }: { events: AgentEvent[]; finished: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const states = agentStates(events, finished);
  const doneCount = AGENTS.filter((a) => states[a.id] === "done").length;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-slate-900">
          <span className="grid size-6 place-items-center rounded-lg bg-[#fa5a1e] text-white">
            <Zap className="size-3.5" aria-hidden />
          </span>
          MULTI-AGENT ORCHESTRATION FLOW
        </p>
        <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            finished
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {finished ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          )}
          {finished ? "Hoàn tất" : `Đang thực thi · ${doneCount}/${AGENTS.length}`}
        </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            title={collapsed ? "Hiện chi tiết" : "Ẩn chi tiết"}
            className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ChevronDown
              className={`size-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {!collapsed && (
      <>

      {/* Agent step cards */}
      <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-5">
        {AGENTS.map((a) => {
          const s = states[a.id];
          const Icon = a.icon;
          return (
            <div
              key={a.id}
              className={`rounded-2xl border px-3 py-2.5 transition ${
                s === "running"
                  ? "border-[#fa5a1e]/50 bg-[#fff7f2] shadow-sm"
                  : s === "done"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-white opacity-70"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {s === "running" ? (
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin text-[#fa5a1e]" aria-hidden />
                ) : s === "done" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                )}
                <span className="font-mono text-[10px] font-semibold text-slate-400">{a.num}</span>
                <span className="truncate text-xs font-semibold text-slate-900">{a.name}</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-slate-500">{a.sub}</p>
              <p
                className={`mt-1 text-[10px] font-medium ${
                  s === "running"
                    ? "text-[#c2410c]"
                    : s === "done"
                      ? "text-emerald-700"
                      : "text-slate-400"
                }`}
              >
                {s === "running" ? "Đang chạy…" : s === "done" ? "Hoàn thành" : s === "skipped" ? "Bỏ qua" : "Sẵn sàng"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Execution stream */}
      <div className="border-t border-slate-100">
        <div className="flex items-center justify-between px-5 py-2.5">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-slate-700">
            <MessagesSquare className="size-3.5 text-[#c2410c]" aria-hidden />
            INTER-AGENT DISPATCH &amp; EXECUTION STREAM
          </p>
          <span className="text-[11px] text-slate-400">{events.length} sự kiện</span>
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto px-5 pb-4">
          {events.length === 0 && (
            <p className="inline-flex items-center gap-2 rounded-xl border border-[#fa5a1e]/20 bg-[#fff7f2] px-3.5 py-2.5 text-xs text-[#c2410c]">
              <Workflow className="size-3.5" aria-hidden />
              Đang kết nối tới orchestrator LogiAI…
            </p>
          )}
          {events.map((e, i) => {
            const meta = AGENTS.find((a) => a.id === e.agent);
            return (
              <div
                key={i}
                className={`rounded-xl border px-3.5 py-2 text-xs leading-5 ${
                  e.status === "running"
                    ? "border-[#fa5a1e]/20 bg-[#fff7f2]"
                    : "border-slate-100 bg-slate-50/70"
                }`}
              >
                <span className="mr-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-[#c2410c]">
                  {e.status === "running" ? (
                    <CircleDashed className="size-3" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-3 text-emerald-600" aria-hidden />
                  )}
                  {(meta?.sub ?? e.agent).toUpperCase()}
                </span>
                <span className="text-slate-700">{e.detail}</span>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
