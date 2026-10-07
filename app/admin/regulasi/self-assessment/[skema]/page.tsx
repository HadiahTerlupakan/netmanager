import { notFound } from "next/navigation";
import { ensurePermission } from "@/lib/rbac";
import { catalogOf, type LicenseScheme } from "@/modules/regulatory";
import { SelfAssessmentClient } from "../SelfAssessmentClient";

/** Satu halaman per jenis izin; tenant bisa memegang keduanya sekaligus. */
const SKEMA_DARI_SLUG: Record<string, LicenseScheme> = {
  "jartaplok-ps": "JARTAPLOK_PS",
  isp: "ISP",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ skema: string }>;
}) {
  const { skema } = await params;
  const dikenal = SKEMA_DARI_SLUG[skema];
  const judul = dikenal
    ? `Self-Assessment ${catalogOf(dikenal).label}`
    : "Self-Assessment Komdigi";
  return {
    title: judul,
    description: "Laporan mandiri standar mutu layanan untuk Komdigi",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ skema: string }>;
}) {
  const { skema } = await params;
  const dikenal = SKEMA_DARI_SLUG[skema];
  if (!dikenal) notFound();

  await ensurePermission("regulasi:read");
  return (
    <SelfAssessmentClient
      skema={dikenal}
      judul={`Self-Assessment ${catalogOf(dikenal).label}`}
    />
  );
}
