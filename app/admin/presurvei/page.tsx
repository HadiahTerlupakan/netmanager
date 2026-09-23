import { ensureAnyPermission } from "@/lib/rbac";
import { DashboardClient } from "./DashboardClient";

export const metadata = {
  title: "Presurvei - Admin Portal",
};

export default async function Page() {
  // Sama dengan gerbang `GET /api/presurvei/prospek`
  // (`app/api/presurvei/prospek/route.ts:20`) yang mengisi kartu corong.
  // Bagian dengan izin lebih sempit disaring di `tentukanBagianDashboard`.
  await ensureAnyPermission(["presurvei:read", "m_presurvei:read"]);

  return <DashboardClient />;
}
