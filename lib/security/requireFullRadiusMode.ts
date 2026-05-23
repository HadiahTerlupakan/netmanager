import { getFullRadiusMode } from "@/modules/settings";
import { FullRadiusModeDisabledError } from "@/modules/network";

/**
 * Guard untuk endpoint accel-ppp / pure RADIUS.
 * Why: ada kebutuhan switch global yang langsung memutus akses ke modul
 * accel-ppp tanpa harus mengubah/menutup tiap endpoint. Kalau toggle OFF
 * setiap call ke route accel-ppp harus ditolak di server-side, frontend
 * tidak boleh bisa bypass.
 * How to apply: panggil di awal handler API accel-ppp sebelum permission
 * check. Throw `FullRadiusModeDisabledError` yang dipetakan ke 403 oleh
 * lapisan handler.
 */
export async function requireFullRadiusMode(): Promise<void> {
  const enabled = await getFullRadiusMode();
  if (!enabled) {
    throw new FullRadiusModeDisabledError();
  }
}
