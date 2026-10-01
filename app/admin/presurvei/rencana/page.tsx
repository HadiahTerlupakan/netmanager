import { ensureAnyPermission } from "@/lib/rbac";
import { RencanaClient } from "./RencanaClient";

export const metadata = {
  title: "Rencana & Penugasan - Admin Portal",
};

/** Halaman rencana kunjungan & penugasan sales. */
export default async function Page() {
  // Dicocokkan ke gerbang web `GET /api/presurvei/rencana` dan rekapnya.
  await ensureAnyPermission(["presurvei_rencana:read"]);

  return <RencanaClient />;
}
