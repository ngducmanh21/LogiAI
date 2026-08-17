import Link from "next/link";

export function LogiLogo({
  className = "",
  showLink = true,
  dark = false,
}: {
  className?: string;
  showLink?: boolean;
  dark?: boolean;
}) {
  const content = (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-[#fa5a1e] font-mono text-sm font-bold text-white shadow-sm">
        HS
      </span>
      <span className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-slate-950"}`}>
        Logi<span className="text-[#fa5a1e]">AI</span>
      </span>
    </span>
  );

  if (showLink) {
    return (
      <Link href="/" className="inline-flex items-center transition-opacity hover:opacity-90" aria-label="LogiAI Trang chủ">
        {content}
      </Link>
    );
  }
  return content;
}
