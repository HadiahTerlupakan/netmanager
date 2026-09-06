import { apiSuccess } from "@/lib/api-response";
import { prisma } from "@/modules/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/service-areas
 *
 * Daftar area layanan untuk saran isian "Area / Lokasi" di halaman registrasi
 * publik. Tenant ditentukan dari domain oleh ekstensi isolasi Prisma, sama
 * seperti endpoint publik lain.
 *
 * Menggantikan `/api/odcs/locations`, yang membaca `Odc.location`. Tabel `Odc`
 * tidak pernah ditulis oleh apa pun di aplikasi ini, sehingga daftar sarannya
 * selalu kosong. Sumbernya diganti ke `Sites` — bukan ke nama node ODC di peta
 * — karena field ini diisi calon pelanggan: orang tahu area tempat tinggalnya,
 * bukan ODC mana yang melayaninya. Nama site juga aman tampil publik, berbeda
 * dengan penamaan topologi internal.
 */
export async function GET() {
  const sites = await prisma.sites.findMany({
    where: { isActive: true },
    select: { name: true },
    distinct: ["name"],
    orderBy: { name: "asc" },
  });

  return apiSuccess(sites.map((site) => site.name));
}
