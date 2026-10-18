import { runAsSystemContext } from "@/lib/tenant-context";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import type { PlayProductionRelease } from "@/lib/google-play/production-track";
import { AppReleaseRepository } from "../repositories/AppReleaseRepository";
import { PLAY_STORE_URL } from "./AppVersionCheckService";

/**
 * Catat rilis produksi Google Play di daftar "Rilis APK (Play Store)" agar
 * daftar itu tidak lagi bergantung pada input manual. Rilis yang sudah ada
 * (termasuk yang dinonaktifkan admin) tidak diubah.
 */
export class PlayApkReleaseRecorder {
  constructor(
    private readonly repository: AppReleaseRepository = new AppReleaseRepository(),
  ) {}

  async ensure(release: PlayProductionRelease): Promise<void> {
    // Dipanggil dari cron tanpa sesi; daftar rilis milik tenant utama.
    await runAsSystemContext("play-store-sync", async () => {
      const existing = await this.repository.findByVersionCode(
        "android",
        release.versionCode,
      );
      if (existing) return;
      await this.repository.create({
        platform: "android",
        version: release.versionName ?? "",
        versionCode: release.versionCode,
        downloadUrl: PLAY_STORE_URL,
        releaseNotes: "Tercatat otomatis dari jalur produksi Google Play.",
        tenantId: MAIN_TENANT_ID,
        createdBy: null,
      });
    });
  }
}
