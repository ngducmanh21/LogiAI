"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, FileScan, MessageCircle, ScrollText } from "lucide-react";

const NAV = [
  { href: "/chat", label: "Tra cứu bằng mô tả", Icon: MessageCircle },
  { href: "/upload", label: "Tra cứu chứng từ", Icon: FileScan },
  { href: "/legal", label: "Văn bản luật", Icon: ScrollText },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "inline-flex items-center gap-1.5 rounded-full bg-[#fa5a1e] px-2.5 py-2 text-sm font-semibold text-white sm:px-3.5 sm:py-1.5"
                : "inline-flex items-center gap-1.5 rounded-full border border-[#fa5a1e]/30 bg-white px-2.5 py-2 text-sm font-medium text-[#c2410c] transition hover:border-[#fa5a1e]/60 sm:px-3.5 sm:py-1.5"
            }
          >
            <Icon className="size-4 sm:size-3.5" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 sm:px-3.5 sm:py-1.5"
        aria-label="Trang chủ"
      >
        <span className="hidden sm:inline">Trang chủ</span>
        <ArrowUpRight className="size-4 sm:size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
