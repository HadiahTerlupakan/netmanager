import { ensureAnyPermission } from "@/lib/rbac";
import { KegiatanDetailClient } from "./KegiatanDetailClient";

export const metadata = {
  title: "Detail Kegiatan - Admin Portal",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Dicocokkan ke gerbang `GET /api/presurvei/kegiatan/[id]`, bukan dipilih:
  // halaman yang lebih longgar dari endpoint-nya menyambut pemakai dengan
  // pesan gagal, dan yang lebih ketat menyembunyikan kegiatan yang sebenarnya
  // boleh ia lihat. Penyaringan "hanya miliknya sendiri" dikerjakan route-nya
  // lewat `isBolehLihatSemuaPresurvei`, bukan di sini.
  await ensureAnyPermission(["presurvei:read", "m_presurvei:read"]);

  // `params` adalah Promise sejak Next 15. Membacanya sebagai objek biasa
  // menghasilkan `undefined` yang lolos `tsc` di repo ini
  // (`strictNullChecks: false`), lalu halaman memanggil
  // `/api/presurvei/kegiatan/undefined` dan setiap pembukaan berakhir 404.
  const { id } = await params;

  return <KegiatanDetailClient kegiatanId={id} />;
}
