import { describe, expect, it } from "vitest";

/**
 * Menu presurvei memakai empat resource permission berbeda. Test ini menjaga
 * agar pemetaannya tidak disederhanakan jadi satu resource bersama — orang
 * tanpa `presurvei_iklan:read` akan melihat menunya lalu ditolak 403.
 */

import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";
import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";

const blokPresurvei = () =>
  ADMIN_MENU_CONFIG.find((item) => item.code === "PRESURVEI");

describe("blok menu presurvei", () => {
  it("terdaftar dengan enam anak", () => {
    const blok = blokPresurvei();

    expect(blok).toBeDefined();
    expect(blok?.children?.map((anak) => anak.code)).toEqual([
      "PRESURVEI.DASHBOARD",
      "PRESURVEI.KEGIATAN",
      "PRESURVEI.PROSPEK",
      "PRESURVEI.IKLAN",
      "PRESURVEI.TARGET",
      "PRESURVEI.LAPORAN",
    ]);
  });

  it("menunjuk path yang benar-benar akan dibangun", () => {
    // Path yang salah ketik menghasilkan menu yang mengarah ke 404, dan
    // compiler tidak akan menolaknya karena keduanya string yang sah.
    const path = Object.fromEntries(
      (blokPresurvei()?.children ?? []).map((anak) => [anak.code, anak.path]),
    );

    expect(path).toEqual({
      "PRESURVEI.DASHBOARD": "/admin/presurvei",
      "PRESURVEI.KEGIATAN": "/admin/presurvei/kegiatan",
      "PRESURVEI.PROSPEK": "/admin/presurvei/prospek",
      "PRESURVEI.IKLAN": "/admin/presurvei/iklan",
      "PRESURVEI.TARGET": "/admin/presurvei/target",
      "PRESURVEI.LAPORAN": "/admin/presurvei/laporan",
    });
  });

  it("memberi tiap sub-menu resource permission-nya sendiri", () => {
    // Inilah alasan task ini ada, dan kedua test di atas TIDAK menjaganya:
    // keduanya tetap hijau meski Step 5 dilewatkan sepenuhnya. Kalau
    // dilewatkan, fallback `getPermissionResource` mengambil segmen
    // TERAKHIR kode — "PRESURVEI.IKLAN" jadi menuntut `iklan:read` yang
    // tidak pernah ada — dan seluruh menu presurvei lenyap untuk semua
    // orang tanpa satu pun error di log.
    const tampil = (izin: string) =>
      filterAdminMenuItems({
        items: ADMIN_MENU_CONFIG,
        hasPermission: (permission) => permission === izin,
        isSuperAdmin: false,
        isFeatureEnabled: (feature) => feature === "presurvei",
      })
        .find((item) => item.code === "PRESURVEI")
        ?.children?.map((anak) => anak.code);

    // Pemegang `presurvei:read` melihat tiga menu inti dan TIDAK melihat
    // iklan, target, atau laporan.
    expect(tampil("presurvei:read")).toEqual([
      "PRESURVEI.DASHBOARD",
      "PRESURVEI.KEGIATAN",
      "PRESURVEI.PROSPEK",
    ]);

    // Pemegang `presurvei_iklan:read` melihat persis satu menu. Bila keenam
    // anak dipetakan ke `presurvei` bersama — kesalahan yang paling mungkin
    // — tak satu pun anak lolos dan hasilnya `undefined`.
    expect(tampil("presurvei_iklan:read")).toEqual(["PRESURVEI.IKLAN"]);
  });

  it("ditandai featureModule supaya bisa dimatikan per tenant", () => {
    // Menghapus properti ini tidak membuat test lain merah: gate di
    // `filterAdminMenuItem` hanya berjalan bila `item.featureModule` truthy,
    // jadi tanpa properti itu gate dilewati dan menu lolos ke semua tenant —
    // termasuk yang modul presurvei-nya dimatikan.
    expect(blokPresurvei()?.featureModule).toBe("presurvei");
  });
});
