import type { Metadata } from "next";
import { StatusPageClient } from "./StatusPageClient";

export const metadata: Metadata = {
  title: "Status Layanan — RADPRO",
  description: "Status real-time gangguan jaringan dan layanan",
};

export const dynamic = "force-dynamic";

export default function StatusPage() {
  return <StatusPageClient />;
}
