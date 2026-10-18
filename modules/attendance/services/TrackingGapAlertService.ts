import { createNotification } from "@/modules/notification";
import { LocationTrackingRepository } from "../repositories/LocationTrackingRepository";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import { ActiveAttendanceSessionService } from "./ActiveAttendanceSessionService";
import { logger } from "@/lib/logger";
import {
  acquireReminderLock,
  releaseReminderLock,
} from "./AttendanceAlertLockService";
import { LocationLiveMapService } from "./LocationLiveMapService";

/** Kunci bertahan lebih lama dari sesi kerja terpanjang (24 jam fleksibel). */
const ALERT_LOCK_TTL_SECONDS = 26 * 60 * 60;

type LiveEntry = Awaited<
  ReturnType<LocationLiveMapService["getLiveLocationsForTenant"]>
>[number];

/**
 * Ingatkan karyawan yang sedang bekerja tetapi lokasinya tidak lagi terkirim.
 * Saat izin dicabut, Android menghentikan aplikasinya, jadi hanya server yang
 * bisa menegur karyawan yang tidak membuka aplikasinya lagi.
 */
export async function runTrackingGapAlerts(): Promise<{
  trackingOff: number;
  notified: number;
}> {
  const liveMap = new LocationLiveMapService(
    new ActiveAttendanceSessionService(),
    new LocationTrackingRepository(),
  );
  const tenantIds = await TenantSettingsRepository.findActiveTenantIds();
  let trackingOff = 0;
  let notified = 0;

  for (const tenantId of tenantIds) {
    const entries = await liveMap.getLiveLocationsForTenant({
      tenantId,
      isSuperAdmin: false,
    });
    for (const entry of entries.filter((item) => item.trackingOff)) {
      trackingOff += 1;
      if (await notifyOnce(entry, tenantId)) notified += 1;
    }
  }

  return { trackingOff, notified };
}

/** Satu notifikasi per jeda: kuncinya berubah begitu titik baru masuk. */
async function notifyOnce(entry: LiveEntry, tenantId: string) {
  const lockKey = [
    "attendance:tracking-off",
    entry.userId,
    entry.checkInTime.getTime(),
    entry.trackingOffSince?.getTime() ?? "none",
  ].join(":");
  if (!(await acquireReminderLock(lockKey, ALERT_LOCK_TTL_SECONDS))) {
    return false;
  }

  try {
    await sendTrackingOffNotification(entry, tenantId);
    return true;
  } catch (error) {
    // Lock dilepas agar jeda ini dicoba lagi lima menit kemudian, bukan
    // terkunci 26 jam tanpa notifikasi.
    await releaseReminderLock(lockKey);
    logger.error("[TrackingGapAlert] Gagal mengirim notifikasi", {
      userId: entry.userId,
      error,
    });
    return false;
  }
}

async function sendTrackingOffNotification(entry: LiveEntry, tenantId: string) {
  // Bukan ALERT/HIGH: keduanya ikut dikirim ke semua admin, padahal admin
  // sudah melihat tracking yang mati di live map.
  await createNotification({
    type: "SYSTEM",
    priority: "NORMAL",
    title: "Tracking lokasi tidak aktif",
    message:
      'Lokasi Anda tidak terkirim selama jam kerja. Buka aplikasi dan pastikan GPS menyala serta izin lokasi "Izinkan sepanjang waktu".',
    userId: entry.userId,
    tenantId,
    sourceType: "ATTENDANCE",
    link: "/karyawan/absensi",
  });
}
