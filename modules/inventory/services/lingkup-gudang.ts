import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";
import { prisma } from "@/modules/database";
import {
  TANPA_BATAS,
  tanpaDataSamaSekali,
  type LingkupSite,
} from "@/modules/roles/client";

/**
 * Penjaga lingkup site untuk endpoint inventory.
 *
 * Dua bentuk pembatasan dilayani di sini:
 * - daftar (barang masuk, transfer, gudang, dashboard, ...) disaring ke site
 *   pengguna lewat {@link siteIdsSaringan};
 * - endpoint yang menunjuk satu gudang langsung dari klien atau dari catatan
 *   yang dibuka, ditolak lewat {@link bolehAksesGudang} / {@link gudangDalamLingkup}.
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

export interface LingkupGudangPenggunaInput {
  userId: string;
  permissions: readonly string[];
  isSuperAdmin: boolean;
  /** Permission pembatas yang berlaku untuk endpoint ini, mis. `barang:site_only`. */
  izinPembatas: readonly string[];
}

interface LingkupGudangInput extends LingkupGudangPenggunaInput {
  gudangId: string;
}

/**
 * Lingkup site pengguna untuk satu endpoint inventory.
 *
 * Pengguna dibatasi bila memegang SALAH SATU permission pembatas endpoint itu.
 * Pengguna yang dibatasi tetapi tanpa site mendapat lingkup kosong — bukan
 * "tanpa batas" — sehingga pemanggil gagal-tertutup.
 */
export async function lingkupSiteGudang(
  input: LingkupGudangPenggunaInput,
): Promise<LingkupSite> {
  if (input.isSuperAdmin) return TANPA_BATAS;
  if (!hasAnyScopeRestriction([...input.permissions], input.izinPembatas)) {
    return TANPA_BATAS;
  }
  return { dibatasi: true, siteIds: await siteIdsPengguna(input.userId) };
}

/**
 * Daftar site untuk menyaring query daftar inventory.
 *
 * - `undefined`: tanpa saringan site;
 * - `[]`: pengguna dibatasi tetapi tanpa site — klausa `{ in: [] }` sengaja
 *   tidak cocok dengan baris mana pun, jadi daftarnya kosong;
 * - selain itu: site yang boleh dilihat.
 *
 * `siteIdDiminta` adalah filter site dari klien. Untuk pengguna yang dibatasi,
 * filter itu hanya dihormati bila masih di dalam lingkupnya; di luar itu
 * diabaikan dan seluruh site miliknya yang dipakai.
 */
export function siteIdsSaringan(
  lingkup: LingkupSite,
  siteIdDiminta?: string,
): string[] | undefined {
  if (!lingkup.dibatasi) return siteIdDiminta ? [siteIdDiminta] : undefined;
  if (tanpaDataSamaSekali(lingkup)) return [];
  if (siteIdDiminta && lingkup.siteIds.includes(siteIdDiminta)) {
    return [siteIdDiminta];
  }
  return [...lingkup.siteIds];
}

/** Apakah gudang dengan site-site ini berada di dalam lingkup pengguna. */
export function gudangDalamLingkup(
  lingkup: LingkupSite,
  gudangSiteIds: readonly string[],
): boolean {
  if (!lingkup.dibatasi) return true;
  return gudangSiteIds.some((siteId) => lingkup.siteIds.includes(siteId));
}

/**
 * Apakah pengguna boleh membaca atau memakai gudang ini.
 *
 * Gagal-tertutup: pengguna yang dibatasi tetapi belum ditugaskan ke site mana
 * pun TIDAK mendapat akses. Memperlakukan "tanpa site" sebagai "semua site"
 * adalah kekeliruan yang berulang di basis kode ini, dan justru membalik arti
 * pembatasannya.
 */
export async function bolehAksesGudang(
  input: LingkupGudangInput,
): Promise<boolean> {
  const lingkup = await lingkupSiteGudang(input);
  if (!lingkup.dibatasi) return true;
  if (tanpaDataSamaSekali(lingkup)) return false;

  const gudang = await prisma.gudang.findFirst({
    where: {
      id: input.gudangId,
      sites: { some: { id: { in: [...lingkup.siteIds] } } },
    },
    select: { id: true },
  });
  return gudang !== null;
}
