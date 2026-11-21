import { acquireLock } from "@/lib/distributed-lock";

import type {
  IRestockRequestLock,
  RestockRequestLockRelease,
} from "../domain/ports/IRestockRequestLock";

/**
 * Kunci harus hidup lebih lama dari penyimpanan terlama di dalamnya: membuat
 * pesanan yang gagal dibuat saat persetujuan, GRN, lalu penutupan pengajuan.
 */
const RESTOCK_REQUEST_LOCK_TTL_SECONDS = 60;

/** Kunci pengajuan restock di Redis lewat `lib/distributed-lock`. */
export class RestockRequestRedisLock implements IRestockRequestLock {
  /** Ambil kunci `restock-request:<id>`; null bila dipegang permintaan lain atau Redis tidak tersedia. */
  acquire(
    purchaseRequestId: string,
  ): Promise<RestockRequestLockRelease | null> {
    return acquireLock(`restock-request:${purchaseRequestId}`, {
      ttlSeconds: RESTOCK_REQUEST_LOCK_TTL_SECONDS,
    });
  }
}
