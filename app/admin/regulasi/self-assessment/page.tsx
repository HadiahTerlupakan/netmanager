import { ensurePermission } from "@/lib/rbac";
import { SelfAssessmentClient } from "./SelfAssessmentClient";

export const metadata = {
  title: "Self-Assessment Komdigi",
  description: "Laporan mandiri standar mutu layanan untuk Komdigi",
};

export default async function Page() {
  await ensurePermission("regulasi:read");
  return <SelfAssessmentClient />;
}
