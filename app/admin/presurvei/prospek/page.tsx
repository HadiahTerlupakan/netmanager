import { ensureAnyPermission } from "@/lib/rbac";
import { ProspekKanbanClient } from "./ProspekKanbanClient";

export const metadata = {
  title: "Papan Prospek - Admin Portal",
};

export default async function Page() {
  // Dicocokkan ke gerbang `GET /api/presurvei/prospek`
  // (`app/api/presurvei/prospek/route.ts:20`), bukan dipilih: halaman yang
  // lebih longgar dari endpoint-nya menyambut pemakai dengan papan yang setiap
  // kolomnya ditolak 403.
  await ensureAnyPermission(["presurvei:read", "m_presurvei:read"]);

  return <ProspekKanbanClient />;
}
