import { getMobileInventoryService } from "@/modules/inventory";

/** Pesan penolakan saat gudang berada di luar lingkup site aktor. */
export const GUDANG_DI_LUAR_LINGKUP_MESSAGE =
  "Akses ditolak: Gudang ini berada di luar site Anda. Pilih gudang di site Anda sendiri.";

type AccessibleGudangLister = (input: {
  actorId: string;
  tenantId: string;
}) => Promise<Array<{ id: string }>>;

/** Daftar gudang yang boleh dipakai aktor mobile, mengikuti `m_barang:site_only`. */
const listMobileAccessibleGudangs: AccessibleGudangLister = (input) =>
  getMobileInventoryService().getGudangs(input);

/**
 * Pastikan setiap gudang pada item material work order mobile boleh dipakai
 * aktornya.
 *
 * Pengambilan dan pengembalian material WO memindahkan stok gudang sama seperti
 * barang keluar/masuk mobile, jadi wajib tunduk pada lingkup site yang sama.
 * Daftar gudangnya dipinjam dari modul inventory supaya aturan pembatasan
 * (termasuk mitra dan multi-site) hanya hidup di satu tempat. Aktor terbatas
 * tanpa site ditolak (fail closed) oleh modul inventory sendiri.
 */
export async function ensureMobileMaterialGudangsAccessible(
  input: { actorId: string; tenantId: string; gudangIds: string[] },
  listAccessibleGudangs: AccessibleGudangLister = listMobileAccessibleGudangs,
): Promise<void> {
  const requestedGudangIds = [...new Set(input.gudangIds)];
  if (requestedGudangIds.length === 0) return;

  const accessibleGudangIds = await loadAccessibleGudangIds(
    { actorId: input.actorId, tenantId: input.tenantId },
    listAccessibleGudangs,
  );
  const hasForbiddenGudang = requestedGudangIds.some(
    (gudangId) => !accessibleGudangIds.has(gudangId),
  );
  if (hasForbiddenGudang) throw new Error(GUDANG_DI_LUAR_LINGKUP_MESSAGE);
}

async function loadAccessibleGudangIds(
  actor: { actorId: string; tenantId: string },
  listAccessibleGudangs: AccessibleGudangLister,
): Promise<Set<string>> {
  try {
    const gudangs = await listAccessibleGudangs(actor);
    return new Set(gudangs.map((gudang) => gudang.id));
  } catch (error) {
    // Penolakan modul inventory (mis. akun terbatas tanpa site) diteruskan
    // sebagai "Akses ditolak" supaya route memetakannya ke 403.
    const reason = error instanceof Error ? error.message : "";
    throw new Error(`Akses ditolak: ${reason}`.trim());
  }
}
