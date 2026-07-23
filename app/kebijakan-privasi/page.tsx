import PrivacyPolicyPageClient from "./PrivacyPolicyPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi RADPRO.ID — bagaimana kami mengumpulkan, menggunakan, dan melindungi data pelanggan SaaS platform manajemen ISP.",
  alternates: { canonical: "/kebijakan-privasi" },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyPageClient />;
}
