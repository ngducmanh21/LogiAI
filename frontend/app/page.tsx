import type { Metadata } from "next";
import { LandingPage } from "../components/landing/landing-page";

export const metadata: Metadata = {
  title: "LogiAI — Tra cứu mã HS & biểu thuế XNK bằng AI",
  description: "Tra cứu mã HS Code và biểu thuế xuất nhập khẩu bằng Multi-Agent RAG: mô tả hàng hóa, nhận mã HS kèm thuế MFN, VAT và ưu đãi FTA.",
};

export default function HomePage() {
  return <LandingPage />;
}
