import { logger } from "@/lib/logger";
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

/**
 * Coba hapus lagi router core yang tertunda, paling lama lebih dulu. Catatan
 * dihapus saat core sukses atau 404, dan dibiarkan pada error lain.
 */
export async function retryVpnCoreRouterDeletes(
  tombstones: Pick<
    IVpnCoreRouterTombstoneRepository,
    "listOldest" | "remove"
  > = new VpnCoreRouterTombstoneRepository(),
): Promise<void> {
  if (!isVpnConfigured()) return;
  const ids = await tombstones.listOldest(VPN_TOMBSTONE_BATCH_SIZE);
  for (const id of ids) {
    try {
      await deleteInCore(id);
      await tombstones.remove(id);
    } catch (error) {
      logger.warn(`[VPN] Hapus ulang router core ${id} gagal:`, error);
    }
  }
}
