import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { BillingEventDispatcher } from "@/modules/events";

/**
 * Scan pelanggan dengan pendingPackageApplyAt <= now, apply pending package,
 * emit PACKAGE_CHANGED event supaya handler Phase 7B disconnect + resync MikroTik.
 * Dijalankan oleh cron harian sebelum billing cycle lain.
 */
export class PendingPackageApplierService {
  /** Apply semua pending package yang sudah jatuh tempo. */
  async applyDuePending(): Promise<{ applied: number; failed: number }> {
    const now = new Date();
    const candidates = await prisma.pelanggan.findMany({
      where: {
        pendingPackageId: { not: null },
        pendingPackageApplyAt: { lte: now },
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

    for (const pelanggan of candidates) {
      if (!pelanggan.pendingPackageId) continue;

      try {
        await this.applyOnePendingPackage(pelanggan);
        applied++;
      } catch (err) {
        failed++;
        logger.error(
          `[PendingPackageApplier] Gagal apply untuk ${pelanggan.id}:`,
          err instanceof Error ? err : undefined,
        );
      }
    }

    logger.info(
      `[PendingPackageApplier] Processed ${candidates.length}: ${applied} applied, ${failed} failed`,
    );
    return { applied, failed };
  }

  /** Apply satu pending package: update DB lalu emit PACKAGE_CHANGED. */
  private async applyOnePendingPackage(pelanggan: {
    id: string;
    nama: string;
    hargaPaketId: string;
    pendingPackageId: string;
    tenantId: string | null;
  }) {
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
      logger.warn(
        `[PendingPackageApplier] Paket lama/baru tidak ditemukan untuk ${pelanggan.id}`,
      );
      throw new Error(`Paket tidak ditemukan untuk pelanggan ${pelanggan.id}`);
    }

    // Apply: pindahkan pending → current, null-kan pending fields
    await prisma.pelanggan.update({
      where: { id: pelanggan.id },
      data: {
        hargaPaketId: pelanggan.pendingPackageId,
        pendingPackageId: null,
        pendingPackageApplyAt: null,
      },
    });

    // Emit PACKAGE_CHANGED dengan applyTime IMMEDIATE — handler disconnect + resync
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
  }
}
