import { SettingsRepository } from "../repositories/SettingsRepository";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

const FULL_RADIUS_MODE_KEY = "FULL_RADIUS_MODE";

/**
 * Setting global yang menentukan apakah jalur accel-ppp / pure RADIUS
 * boleh digunakan oleh aplikasi.
 *
 * Why: dipakai sebagai single switch untuk memutus jalur accel-ppp tanpa
 * menghapus data server yang sudah teregistrasi.
 * How to apply: panggil `getFullRadiusMode()` dari middleware/route guard
 * sebelum memproses request modul accel-ppp; gunakan `setFullRadiusMode()`
 * dari halaman pengaturan untuk toggle.
 */
export async function getFullRadiusMode(
  repository: ISettingsRepository = SettingsRepository,
): Promise<boolean> {
  const [setting] = await repository.findManyByKeys([FULL_RADIUS_MODE_KEY]);
  return setting?.value === "true";
}

/** Set Full RADIUS Mode toggle. Disimpan sebagai string "true"|"false". */
export async function setFullRadiusMode(
  enabled: boolean,
  repository: ISettingsRepository = SettingsRepository,
): Promise<void> {
  await repository.upsertMany([
    {
      key: FULL_RADIUS_MODE_KEY,
      value: enabled ? "true" : "false",
      description: "Toggle global untuk jalur accel-ppp pure RADIUS",
      encrypted: false,
    },
  ]);
}

export { FULL_RADIUS_MODE_KEY };
