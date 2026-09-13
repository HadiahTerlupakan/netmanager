import { logger } from "@/lib/logger";
import {
  notifyPackageUpgradeCancelled,
  notifyPackageUpgradeRequested,
} from "@/modules/notification";

interface UpgradeRequestNotificationInput {
  customerId: string;
  customerName: string;
  currentPackageName: string;
  targetPackageName: string;
  applyAt: Date;
  siteId?: string | null;
  tenantId?: string | null;
}

/**
 * Beri tahu pengelola pelanggan tentang pengajuan upgrade dari portal.
 *
 * Sengaja fire-and-forget: kegagalan mengirim notifikasi tidak boleh membatalkan
 * pengajuan yang sudah tersimpan — pelanggan akan melihat error padahal
 * jadwalnya sudah masuk.
 */
export function notifyUpgradeRequested(
  input: UpgradeRequestNotificationInput,
): void {
  notifyPackageUpgradeRequested(input).catch((error) =>
    logger.error("[PackageUpgrade Notif] Error:", error),
  );
}

interface UpgradeCancellationNotificationInput {
  customerId: string;
  customerName: string;
  targetPackageName: string;
  siteId?: string | null;
  tenantId?: string | null;
}

/**
 * Beri tahu pengelola pelanggan bahwa pengajuan upgrade dibatalkan.
 *
 * Fire-and-forget dengan alasan yang sama seperti notifikasi pengajuan:
 * pembatalannya sudah tersimpan, jangan digagalkan karena notifikasi.
 */
export function notifyUpgradeCancelled(
  input: UpgradeCancellationNotificationInput,
): void {
  notifyPackageUpgradeCancelled(input).catch((error) =>
    logger.error("[PackageUpgrade Notif] Error:", error),
  );
}
