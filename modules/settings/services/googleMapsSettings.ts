import { SettingsRepository } from "../repositories/SettingsRepository";
import type { SettingsEntity } from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

/**
 * Setelan Google Maps JavaScript API.
 *
 * Ketiga nilainya disimpan TANPA enkripsi, dan itu disengaja. Maps JavaScript
 * API memuat skripnya dari browser dengan API key di URL, jadi key itu
 * terlihat oleh siapa pun yang membuka DevTools pada setiap halaman berpeta.
 * Menyimpannya terenkripsi lalu menampilkannya sebagai `••••••••` di form akan
 * menyiratkan kerahasiaan yang tidak pernah ada, dan menyesatkan administrator
 * berikutnya yang membaca kode ini.
 *
 * Pengaman yang sesungguhnya ada di Google Cloud Console: pembatasan HTTP
 * referrer, pembatasan API, dan batas kuota harian. Polanya sama dengan
 * `captcha_site_key` di `captchaSettings.ts`, yang menghadapi persoalan
 * identik dan sudah memutuskan hal yang sama.
 */
export type GoogleMapsSettingsPayload = {
  enabled: boolean;
  /** API key Maps JavaScript API; publik secara desain. */
  apiKey: string;
  /** Map ID berbasis cloud; `AdvancedMarker` tidak tampil tanpanya. */
  mapId: string;
};

export const GOOGLE_MAPS_SETTINGS_KEYS = [
  "GOOGLE_MAPS_ENABLED",
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_MAP_ID",
] as const;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

const SETELAN_KOSONG: GoogleMapsSettingsPayload = {
  enabled: false,
  apiKey: "",
  mapId: "",
};

/** Memetakan baris setelan menjadi payload Google Maps. */
export function mapGoogleMapsSettingsResponse(
  records: SettingsEntity[],
): GoogleMapsSettingsPayload {
  const nilai = new Map(records.map((record) => [record.key, record.value]));

  return {
    enabled: nilai.get("GOOGLE_MAPS_ENABLED") === "true",
    apiKey: nilai.get("GOOGLE_MAPS_API_KEY")?.trim() || "",
    mapId: nilai.get("GOOGLE_MAPS_MAP_ID")?.trim() || "",
  };
}

/**
 * Apakah setelan ini cukup untuk benar-benar menampilkan peta.
 *
 * Saklar `enabled` saja tidak cukup: tanpa Map ID, `AdvancedMarker` gagal
 * diam-diam — petanya tampil, penandanya tidak, dan tidak ada galat apa pun.
 * Kegagalan sunyi seperti itu paling mahal ditemukan di produksi, jadi Map ID
 * diperlakukan sebagai syarat aktif, bukan pelengkap.
 */
export function isGoogleMapsSiapPakai(
  payload: GoogleMapsSettingsPayload,
): boolean {
  return payload.enabled && payload.apiKey !== "" && payload.mapId !== "";
}

/**
 * Setelan apa adanya, termasuk saat belum lengkap.
 *
 * Form administrator tidak memakai ini — halaman `/admin/pengaturan/api`
 * membacanya lewat `getApiSettings` bersama Gemini dan R2. Yang tersisa di
 * sini hanya pembacaan untuk `getGoogleMapsSettingsUntukKlien` di bawah.
 */
export async function getGoogleMapsSettings(
  tenantId?: string | null,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<GoogleMapsSettingsPayload> {
  const records = await repository.findManyByKeys(
    GOOGLE_MAPS_SETTINGS_KEYS,
    tenantId ?? undefined,
  );
  return mapGoogleMapsSettingsResponse(records);
}

/**
 * Setelan yang boleh diterima komponen peta di browser.
 *
 * Menahan key selama fitur belum siap — meniru `publicCaptchaSettings` — agar
 * key tidak beredar di halaman yang toh tidak akan menampilkan peta.
 */
export async function getGoogleMapsSettingsUntukKlien(
  tenantId?: string | null,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<GoogleMapsSettingsPayload> {
  const setelan = await getGoogleMapsSettings(tenantId, repository);
  return isGoogleMapsSiapPakai(setelan) ? setelan : SETELAN_KOSONG;
}
