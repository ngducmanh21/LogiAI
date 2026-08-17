import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogiAI",
  description: "Tra cứu mã HS Code & biểu thuế XNK thông minh bằng Multi-Agent RAG",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
