import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { getGoogleMapsSettingsUntukKlien } from "@/modules/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/maps — setelan peta untuk komponen peta di browser.
 *
 * Hanya membaca. Penulisannya ada di `PUT /api/settings/api` bersama setelan
 * integrasi lain, karena halaman `/admin/pengaturan/api` yang mengelolanya.
 *
 * Sengaja TANPA `permissions`, cukup sesi yang sah. Peta muncul di layar yang
 * penggunanya belum tentu punya `map:read`: pemilih koordinat pelanggan PPP,
 * Site Work Order, live-map kehadiran, dan peta kegiatan presurvei.
 * Menggantungkan API key pada `map:read` akan mengulang persis jebakan yang
 * sudah pernah diperbaiki di peta rencana OSP — petanya tampak kosong padahal
 * datanya ada, dan tidak ada yang tahu sebabnya.
 *
 * Yang dikirim pun bukan rahasia: API key Maps JavaScript API memang sampai ke
 * browser pada setiap halaman berpeta. Pengamannya pembatasan HTTP referrer di
 * Google Cloud Console, bukan kerahasiaan nilai ini.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const setelan = await getGoogleMapsSettingsUntukKlien(
    requireSessionTenantId(ctx),
  );

  return apiSuccess(setelan);
});
