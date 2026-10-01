import { ensureAnyPermission } from "@/lib/rbac";
import { PenilaianClient } from "./PenilaianClient";

export const metadata = {
  title: "Penilaian Kinerja - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_rencana:read", "presurvei_laporan:read"]);

  return <PenilaianClient />;
}
