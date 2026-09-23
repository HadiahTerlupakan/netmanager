import { ensureAnyPermission } from "@/lib/rbac";
import { LaporanClient } from "./LaporanClient";

export const metadata = {
  title: "Laporan Pencapaian - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_laporan:read"]);

  return <LaporanClient />;
}
