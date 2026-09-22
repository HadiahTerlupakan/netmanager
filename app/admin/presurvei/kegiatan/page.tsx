import { ensureAnyPermission } from "@/lib/rbac";
import { KegiatanClient } from "./KegiatanClient";

export const metadata = {
  title: "Kegiatan Sales - Admin Portal",
};

export default async function Page() {
  // Dicocokkan ke gerbang `GET /api/presurvei/kegiatan`, bukan dipilih: halaman
  // yang lebih longgar dari endpoint-nya menyambut pemakai dengan tabel 403,
  // dan yang lebih ketat menyembunyikan data yang sebenarnya boleh ia lihat.
  await ensureAnyPermission(["presurvei:read", "m_presurvei:read"]);

  return <KegiatanClient />;
}
