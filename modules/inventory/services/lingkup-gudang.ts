import { prisma } from "@/modules/database";

/**
 * Penjaga lingkup site untuk endpoint inventory yang menerima `gudangId`
 * langsung dari klien.
 *
 * Endpoint semacam itu tidak punya daftar untuk disaring — ia melayani satu
 * gudang yang ditunjuk pemanggil. Maka pembatasannya harus berupa penolakan:
 * gudang di luar site pengguna tidak boleh dijawab, bukan sekadar tidak
 * ditampilkan.
 *
 * Multi-site dipakai sejak awal (`User.siteId` + relasi `userSites`) supaya
 * pengguna yang memegang beberapa site tidak kehilangan gudang keduanya —
 * kekeliruan yang tersebar di modul lain dan sengaja tidak diulang di sini.
 */

/** Site yang boleh diakses pengguna: site utama plus seluruh site tambahannya. */
async function siteIdsPengguna(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { siteId: true, userSites: { select: { siteId: true } } },
  });
  if (!user) return [];

  const semua = [
    ...(user.siteId ? [user.siteId] : []),
    ...user.userSites.map((us) => us.siteId),
  ];
  return [...new Set(semua)];
}

interface LingkupGudangInput {
  userId: string;
  gudangId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  /** Permission pembatas yang berlaku untuk endpoint ini, mis. `barang:site_only`. */
  izinPembatas: string[];
}

/**
 * Apakah pengguna boleh membaca data gudang ini.
 *
 * Gagal-tertutup: pengguna yang dibatasi tetapi belum ditugaskan ke site mana
 * pun TIDAK mendapat akses. Memperlakukan "tanpa site" sebagai "semua site"
 * adalah kekeliruan yang berulang di basis kode ini, dan justru membalik arti
 * pembatasannya.
 */
export async function bolehAksesGudang(
  input: LingkupGudangInput,
): Promise<boolean> {
  if (input.isSuperAdmin) return true;

  const dibatasi = input.permissions.some((izin) =>
    input.izinPembatas.includes(izin),
  );
  if (!dibatasi) return true;

  const siteIds = await siteIdsPengguna(input.userId);
  if (siteIds.length === 0) return false;

  const gudang = await prisma.gudang.findFirst({
    where: { id: input.gudangId, sites: { some: { id: { in: siteIds } } } },
    select: { id: true },
  });
  return gudang !== null;
}
