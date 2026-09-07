import { logger } from "@/lib/logger";
import { getGeneralSettings } from "./generalSettings";

/**
 * Toggle kanal notifikasi milik tenant.
 *
 * Tiga sakelar di Pengaturan Umum (`notifApp`, `notifWa`, `notifEmail`) selama
 * ini hanya disimpan dan dibaca oleh halaman pengaturannya sendiri — tidak ada
 * satu pun jalur pengiriman yang membacanya, sehingga mematikan WhatsApp di UI
 * tidak berpengaruh apa pun.
 */

export interface NotificationChannelToggles {
  push: boolean;
  whatsapp: boolean;
  email: boolean;
}

/**
 * Pengiriman massal (mis. pengingat tagihan) memanggil ini sekali per
 * pelanggan. Nilai sakelar nyaris tidak pernah berubah, jadi hasilnya ditahan
 * sebentar supaya satu blast tidak berubah menjadi ratusan kueri settings.
 */
const CACHE_TTL_MS = 30_000;

/** Dipakai saat pengaturan tidak bisa dibaca — lihat alasan fail-open di bawah. */
const ALL_CHANNELS_ENABLED: NotificationChannelToggles = {
  push: true,
  whatsapp: true,
  email: true,
};
const GLOBAL_CACHE_KEY = "__global__";

const togglesCache = new Map<
  string,
  { value: NotificationChannelToggles; expiresAt: number }
>();

/** Kosongkan cache — dipakai setelah pengaturan disimpan dan oleh tes. */
export function clearNotificationChannelTogglesCache(): void {
  togglesCache.clear();
}

/** Baca toggle kanal notifikasi untuk sebuah tenant. */
export async function getNotificationChannelToggles(
  tenantId?: string | null,
): Promise<NotificationChannelToggles> {
  const cacheKey = tenantId ?? GLOBAL_CACHE_KEY;
  const cached = togglesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let value: NotificationChannelToggles;
  try {
    const settings = await getGeneralSettings(undefined, tenantId);
    value = {
      push: settings.notifApp,
      whatsapp: settings.notifWa,
      email: settings.notifEmail,
    };
  } catch (error) {
    // Fail-open: kegagalan membaca pengaturan tidak boleh membungkam
    // notifikasi, sama seperti perlakuan pada kegagalan dedupe Redis.
    logger.warn(
      `[NotificationChannelToggles] Gagal membaca pengaturan, semua kanal dianggap aktif: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return ALL_CHANNELS_ENABLED;
  }

  togglesCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  return value;
}
