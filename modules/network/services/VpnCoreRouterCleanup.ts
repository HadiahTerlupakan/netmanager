import { logger } from "@/lib/logger";
import { runAsSystemContext } from "@/lib/tenant-context";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import { VpnCoreRouterTombstoneRepository } from "../repositories/VpnCoreRouterTombstoneRepository";
import {
  getVpnCoreClient,
  isVpnConfigured,
  VpnCoreError,
} from "../vpn/VpnCoreClient";

/** Jumlah maksimum catatan yang dicoba ulang dalam satu siklus monitor. */
export const VPN_TOMBSTONE_BATCH_SIZE = 50;
const HTTP_NOT_FOUND = 404;

type TombstoneWriter = Pick<IVpnCoreRouterTombstoneRepository, "add">;

async function deleteInCore(coreRouterId: string): Promise<void> {
  try {
    await getVpnCoreClient().deleteRouter(coreRouterId);
  } catch (error) {
    if (error instanceof VpnCoreError && error.status === HTTP_NOT_FOUND) {
      return;
    }
    throw error;
  }
}

/** Catat router core agar dihapus oleh siklus monitor berikutnya. */
export async function tombstoneCoreRouter(
  coreRouterId: string,
  tombstones: TombstoneWriter,
): Promise<void> {
  try {
    await tombstones.add(coreRouterId);
  } catch (error) {
    logger.error(
      `[VPN] Gagal mencatat tombstone router core ${coreRouterId}:`,
      error,
    );
  }
}

/**
 * Hapus router di core; bila gagal (atau VPN belum dikonfigurasi) catat
 * tombstone agar monitor mencoba lagi. Tidak pernah melempar karena router
 * lokal sudah terhapus saat fungsi ini dipanggil.
 */
export async function deleteCoreRouterOrTombstone(
  coreRouterId: string,
  tombstones: TombstoneWriter,
): Promise<void> {
  if (!isVpnConfigured()) {
    await tombstoneCoreRouter(coreRouterId, tombstones);
    return;
  }
  try {
    await deleteInCore(coreRouterId);
  } catch (error) {
    logger.error(
      `[VPN] Gagal menghapus router core ${coreRouterId}, dijadwalkan ulang:`,
      error,
    );
    await tombstoneCoreRouter(coreRouterId, tombstones);
  }
}

type TombstoneRetryRepository = Pick<
  IVpnCoreRouterTombstoneRepository,
  "listOldest" | "remove" | "isUsedByRouter"
>;

// Tombstone draft yang claim-nya timeout bisa menunjuk router core yang
// ternyata sudah dipakai router netmanager (claim ulang berhasil). Menghapusnya
// di core akan memutus tunnel dan RADIUS router itu, jadi catatannya dibuang.
async function dropIfUsed(
  id: string,
  tombstones: TombstoneRetryRepository,
): Promise<boolean> {
  if (!(await tombstones.isUsedByRouter(id))) return false;
  logger.warn(
    `[VPN] Router core ${id} dipakai router aktif, tombstone dibuang tanpa menghapus`,
  );
  await tombstones.remove(id);
  return true;
}

async function retryBatch(tombstones: TombstoneRetryRepository): Promise<void> {
  const ids = await tombstones.listOldest(VPN_TOMBSTONE_BATCH_SIZE);
  for (const id of ids) {
    try {
      if (await dropIfUsed(id, tombstones)) continue;
      await deleteInCore(id);
      await tombstones.remove(id);
    } catch (error) {
      logger.warn(`[VPN] Hapus ulang router core ${id} gagal:`, error);
      return;
    }
  }
}

/**
 * Coba hapus lagi router core yang tertunda, paling lama lebih dulu. Catatan
 * dihapus saat core sukses atau 404, atau tanpa menghapus di core bila id-nya
 * dipakai router netmanager (dicek lintas tenant). Error lain berarti core
 * sedang bermasalah, jadi batch berhenti dan sisanya menunggu siklus berikutnya.
 */
export async function retryVpnCoreRouterDeletes(
  tombstones: TombstoneRetryRepository = new VpnCoreRouterTombstoneRepository(),
): Promise<void> {
  if (!isVpnConfigured()) return;
  await runAsSystemContext("retryVpnCoreRouterDeletes: cek router aktif", () =>
    retryBatch(tombstones),
  );
}
