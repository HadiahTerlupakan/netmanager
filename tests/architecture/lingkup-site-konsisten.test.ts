import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Konsistensi pembatasan data per site: pola gagal-terbuka tidak boleh muncul
 * lagi. Ketiganya menuliskan "tanpa site" sebagai "tanpa filter", sehingga
 * pengguna yang DIBATASI justru melihat seluruh tenant. Kontrak penggantinya ada
 * di `modules/roles/domain/lingkup-site.ts`, yang membuat bentuk itu tidak bisa
 * ditulis.
 *
 * Arah "setiap toggle di halaman Hak Akses benar-benar ditegakkan" dulu dijaga
 * di sini dengan daftar utang `BELUM_DITEGAKKAN`. Sejak 2026-11-03 penjaganya
 * pindah ke `katalog-toggle-pembatasan.test.ts`, yang juga mencakup toggle dari
 * default katalog dan tanpa daftar utang: toggle tanpa pembaca dibuang dari
 * katalog.
 */

/** Berkas yang hanya MENDEKLARASIKAN nama permission, bukan menegakkannya. */
const BERKAS_DEKLARASI = [
  "lib/role-templates.ts",
  "lib/permission-aliases.ts",
  "lib/permission-config.ts",
  "lib/resource-capabilities.ts",
];

const DIREKTORI_IMPLEMENTASI = "lib/authorization/";

function kumpulkanBerkas(direktori: string): string[] {
  return readdirSync(direktori).flatMap((entri) => {
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) return kumpulkanBerkas(jalur);
    return /\.tsx?$/.test(entri) ? [jalur] : [];
  });
}

function berkasSumber(): string[] {
  return ["app", "modules", "lib"]
    .flatMap(kumpulkanBerkas)
    .map((jalur) => relative(process.cwd(), jalur))
    .filter(
      (jalur) =>
        !BERKAS_DEKLARASI.includes(jalur) &&
        !jalur.startsWith(DIREKTORI_IMPLEMENTASI),
    );
}

/** Berkas yang MENJELASKAN pola salahnya di komentar, bukan memakainya. */
const BERKAS_KONTRAK = [
  "modules/roles/domain/lingkup-site.ts",
  "modules/attendance/services/AdminScopeResolver.ts",
];

/**
 * Pemindaian pola dibatasi ke lapisan server. `|| ""` pada komponen `.tsx`
 * umumnya nilai awal form, bukan keputusan otorisasi — memindainya hanya
 * menghasilkan derau yang menenggelamkan pelanggaran sungguhan.
 */
function berkasServer(): string[] {
  return berkasSumber().filter(
    (jalur) =>
      jalur.endsWith(".ts") &&
      !BERKAS_KONTRAK.includes(jalur) &&
      // Halaman admin adalah lapisan UI: `|| ""` di sana nilai awal form,
      // bukan keputusan otorisasi.
      !jalur.startsWith("app/admin/"),
  );
}

describe("pola gagal-terbuka tidak boleh muncul lagi", () => {
  /**
   * `allowedSiteIds.length > 0 ? {...} : {}` — daftar site kosong jatuh ke
   * "tanpa filter". Pengguna terbatas tanpa site melihat seluruh tenant.
   */
  it("tidak ada ternary panjang-nol pada daftar site", () => {
    const pelanggar: string[] = [];
    const pola = /(allowedSiteIds|siteIds)(\?)?\.length\s*>\s*0\s*(\?|&&)/g;

    for (const jalur of berkasServer()) {
      const sumber = readFileSync(join(process.cwd(), jalur), "utf8");
      for (const cocok of sumber.matchAll(pola)) {
        const barisKe = sumber.slice(0, cocok.index).split("\n").length;
        pelanggar.push(`${jalur}:${barisKe}`);
      }
    }

    expect(pelanggar).toEqual(DIKETAHUI_TERNARY);
  });

  /** `dbUser?.siteId || ""` — string kosong falsy, pembatasannya hilang. */
  it("tidak ada siteId yang dijatuhkan ke string kosong", () => {
    const pelanggar: string[] = [];
    const pola = /siteId\s*(\|\||\?\?)\s*""/g;

    for (const jalur of berkasServer()) {
      const sumber = readFileSync(join(process.cwd(), jalur), "utf8");
      for (const cocok of sumber.matchAll(pola)) {
        const barisKe = sumber.slice(0, cocok.index).split("\n").length;
        pelanggar.push(`${jalur}:${barisKe}`);
      }
    }

    expect(pelanggar).toEqual(DIKETAHUI_STRING_KOSONG);
  });
});

describe("pencatatan inventory tidak kehilangan permission", () => {
  /**
   * `buildInventoryAccessSession(user)` tanpa permission adalah akar bug
   * 2026-11-02: objek user dari `createHandler` tidak membawa permission, jadi
   * `validateGudangSiteAccess` tidak pernah melihat `*:site_only` dan
   * pencatatan barang masuk/keluar/transfer lolos ke gudang site mana pun.
   */
  it("setiap buildInventoryAccessSession menyertakan permission", () => {
    const pelanggar: string[] = [];
    const pola = /buildInventoryAccessSession\(\s*[^,()]+\s*\)/g;

    for (const jalur of berkasServer()) {
      const sumber = readFileSync(join(process.cwd(), jalur), "utf8");
      for (const cocok of sumber.matchAll(pola)) {
        const barisKe = sumber.slice(0, cocok.index).split("\n").length;
        pelanggar.push(`${jalur}:${barisKe}`);
      }
    }

    expect(pelanggar).toEqual([]);
  });
});

/**
 * Pelanggaran yang sudah ada saat penjaga ini ditulis. Keduanya utang yang
 * diakui — boleh menyusut, tidak boleh bertambah.
 */
const DIKETAHUI_TERNARY: string[] = [
  // `hasGudangSiteAccess` mengembalikan boolean, bukan filter: daftar kosong
  // menghasilkan `false` alias ditolak. Gagal-tertutup, jadi aman.
  "modules/inventory/utils/validation.ts:213",
];

const DIKETAHUI_STRING_KOSONG: string[] = [];
