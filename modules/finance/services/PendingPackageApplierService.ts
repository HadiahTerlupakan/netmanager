import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { BillingEventDispatcher } from "@/modules/events";

type PendingCandidate = {
  id: string;
  nama: string;
  hargaPaketId: string;
  pendingPackageId: string;
  tenantId: string | null;
};

type ApplyOutcome = "applied" | "stale";

/**
 * Scan pelanggan dengan pendingPackageApplyAt <= now, apply pending package,
 * emit PACKAGE_CHANGED event supaya handler Phase 7B disconnect + resync MikroTik.
 * Dijalankan oleh cron sebelum billing cycle lain.
 *
 * Catatan timezone: `pendingPackageApplyAt` di-store sebagai timestamp UTC
 * (Postgres timestamptz, default Prisma). Comparison di sini juga UTC.
 * Kalau billing cycle pelanggan mengikuti zona Asia/Jakarta, pastikan
 * `pendingPackageApplyAt` di-set ke instant UTC yang sesuai (mis. 17:00 UTC
 * untuk awal hari Jakarta berikutnya).
 */
export class PendingPackageApplierService {
  /**
   * Apply semua pending package yang sudah jatuh tempo.
   * `applyAtBefore` opsional — default `new Date()`. Berguna untuk test
   * deterministic dan untuk mengeksplisitkan window cron.
   */
  async applyDuePending(
    applyAtBefore: Date = new Date(),
  ): Promise<{ applied: number; failed: number; staleSkipped: number }> {
    const candidates = await prisma.pelanggan.findMany({
      where: {
        pendingPackageId: { not: null },
        pendingPackageApplyAt: { lte: applyAtBefore },
      },
      select: {
        id: true,
        nama: true,
        hargaPaketId: true,
        pendingPackageId: true,
        tenantId: true,
      },
    });

    let applied = 0;
    let failed = 0;
    let staleSkipped = 0;

    for (const pelanggan of candidates) {
      if (!pelanggan.pendingPackageId) continue;

      try {
        const outcome = await this.applyOnePendingPackage(
          pelanggan as PendingCandidate,
          applyAtBefore,
        );
        if (outcome === "applied") applied++;
        else staleSkipped++;
      } catch (err) {
        failed++;
        logger.error(
          `[PendingPackageApplier] Gagal apply untuk ${pelanggan.id}:`,
          err instanceof Error ? err : undefined,
        );
      }
    }

    logger.info(
      `[PendingPackageApplier] at ${applyAtBefore.toISOString()} (UTC) — processed ${candidates.length}: ${applied} applied, ${staleSkipped} stale, ${failed} failed`,
    );
    return { applied, failed, staleSkipped };
  }

  /**
   * Apply satu pending package secara atomic via optimistic update.
   *
   * Mencegah TOCTOU race: kalau di antara `findMany` dan update terjadi
   * mutasi konkuren (admin cancel pending, IMMEDIATE upgrade ke paket
   * berbeda, atau applier paralel sudah memproses), `updateMany` akan
   * match 0 row dan kita skip — tidak emit event dengan oldPackageId
   * yang salah.
   */
  private async applyOnePendingPackage(
    pelanggan: PendingCandidate,
    applyAtBefore: Date,
  ): Promise<ApplyOutcome> {
    const updateResult = await prisma.pelanggan.updateMany({
      where: {
        id: pelanggan.id,
        hargaPaketId: pelanggan.hargaPaketId,
        pendingPackageId: pelanggan.pendingPackageId,
        pendingPackageApplyAt: { lte: applyAtBefore },
      },
      data: {
        hargaPaketId: pelanggan.pendingPackageId,
        pendingPackageId: null,
        pendingPackageApplyAt: null,
      },
    });

    if (updateResult.count === 0) {
      logger.warn(
        `[PendingPackageApplier] State pelanggan ${pelanggan.id} berubah sebelum apply (cancelled/IMMEDIATE-overridden/already-applied), skip.`,
      );
      return "stale";
    }

    // Setelah update sukses, snapshot `pelanggan.hargaPaketId` valid sebagai
    // oldPackageId — updateMany barusan match exactly nilai itu di DB.
    const [oldPkg, newPkg] = await Promise.all([
      prisma.hargaPaket.findUnique({
        where: { id: pelanggan.hargaPaketId },
        select: { harga: true, profilePPP: { select: { name: true } } },
      }),
      prisma.hargaPaket.findUnique({
        where: { id: pelanggan.pendingPackageId },
        select: { harga: true, profilePPP: { select: { name: true } } },
      }),
    ]);

    if (!oldPkg || !newPkg) {
      // DB sudah ter-update (hargaPaketId berubah) tapi paket reference hilang.
      // Ini HARUS throw supaya BullMQ retry — kalau silent skip, MikroTik
      // tidak pernah tahu paket berubah dan pelanggan dapat bandwidth salah.
      throw new Error(
        `[PendingPackageApplier] CRITICAL: Paket lama/baru tidak ditemukan untuk ${pelanggan.id} setelah DB update — MikroTik tidak di-sync. Perlu manual intervention.`,
      );
    }

    await BillingEventDispatcher.onPackageChanged({
      customerId: pelanggan.id,
      customerName: pelanggan.nama,
      oldPackageId: pelanggan.hargaPaketId,
      newPackageId: pelanggan.pendingPackageId,
      oldProfileName: oldPkg.profilePPP?.name ?? "",
      newProfileName: newPkg.profilePPP?.name ?? "",
      oldPackagePrice: oldPkg.harga,
      newPackagePrice: newPkg.harga,
      applyTime: "IMMEDIATE",
      tenantId: pelanggan.tenantId ?? undefined,
    });

    logger.info(
      `[PendingPackageApplier] Applied pending package for ${pelanggan.id}: ${pelanggan.hargaPaketId} → ${pelanggan.pendingPackageId}`,
    );
    return "applied";
  }
}
