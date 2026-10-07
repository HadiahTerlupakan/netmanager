import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { RESOURCE_CAPABILITIES } from "@/lib/resource-capabilities";

/**
 * Konsistensi pembatasan data per site, dijaga dari dua arah.
 *
 * 1. Pola gagal-terbuka tidak boleh muncul lagi. Ketiganya menuliskan
 *    "tanpa site" sebagai "tanpa filter", sehingga pengguna yang DIBATASI
 *    justru melihat seluruh tenant. Kontrak penggantinya ada di
 *    `modules/roles/domain/lingkup-site.ts`, yang membuat bentuk itu tidak bisa
 *    ditulis.
 *
 * 2. Setiap toggle di halaman Hak Akses harus benar-benar ditegakkan. Test
 *    pasangannya (`site-restriction-capability-catalog`) sudah menjaga arah
 *    sebaliknya — setiap pembatasan yang ditegakkan wajib punya toggle — tetapi
 *    arah ini tidak dijaga siapa pun, dan 23 toggle lolos tanpa efek apa pun.
 *    Pemilik role menyalakannya, yakin datanya terbatas, padahal tidak terjadi
 *    apa-apa.
 *
 * Daftar `BELUM_DITEGAKKAN` adalah utang yang diakui, bukan izin. Ia boleh
 * menyusut, tidak boleh bertambah: toggle baru tanpa penegakan akan menggagalkan
 * test ini.
 */

const SCOPE_ACTIONS = ["site_only", "department_only"] as const;

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

/** Argumen ke-`indeks` tiap pemanggilan `nama(...)`, dengan kurung berimbang. */
function argumenLiteral(
  sumber: string,
  nama: string,
  indeks: number,
): string[] {
  const penanda = `${nama}(`;
  const hasil: string[] = [];

  for (
    let i = sumber.indexOf(penanda);
    i !== -1;
    i = sumber.indexOf(penanda, i + penanda.length)
  ) {
    let kedalaman = 1;
    let argumen = 0;
    let kini = "";

    for (let c = i + penanda.length; c < sumber.length; c += 1) {
      const karakter = sumber[c]!;
      if (karakter === "(") kedalaman += 1;
      if (karakter === ")") kedalaman -= 1;
      if (kedalaman === 0) break;
      if (karakter === "," && kedalaman === 1) {
        argumen += 1;
        if (argumen > indeks) break;
        kini = "";
        continue;
      }
      if (argumen === indeks) kini += karakter;
    }

    const literal = kini.trim().match(/^"([a-z_0-9]+)"$/);
    if (literal) hasil.push(literal[1]!);
  }

  return hasil;
}

const PEMANGGIL_LINGKUP = [
  "checkSiteRestriction",
  "canAccessSite",
  "getSiteFilters",
  "buildMultiSiteWhereClause",
  "validateSiteAccess",
];

function pembatasanDitegakkan(): Set<string> {
  const ditegakkan = new Set<string>();

  for (const jalur of berkasSumber()) {
    const sumber = readFileSync(join(process.cwd(), jalur), "utf8");

    for (const aksi of SCOPE_ACTIONS) {
      for (const cocok of sumber.matchAll(
        new RegExp(`"([a-z_0-9]+):${aksi}"`, "g"),
      )) {
        ditegakkan.add(`${cocok[1]}:${aksi}`);
      }
    }

    for (const nama of PEMANGGIL_LINGKUP) {
      for (const resource of argumenLiteral(sumber, nama, 1)) {
        ditegakkan.add(`${resource}:site_only`);
      }
    }
  }

  return ditegakkan;
}

function toggleDiKatalog(): Set<string> {
  const toggle = new Set<string>();
  for (const [resource, kemampuan] of Object.entries(RESOURCE_CAPABILITIES)) {
    for (const aksi of SCOPE_ACTIONS) {
      if ((kemampuan.actions as readonly string[]).includes(aksi)) {
        toggle.add(`${resource}:${aksi}`);
      }
    }
  }
  return toggle;
}

/**
 * Toggle yang ada di halaman Hak Akses tetapi belum ditegakkan kode mana pun.
 * Snapshot 2026-10-07. Boleh menyusut, tidak boleh bertambah.
 */
const BELUM_DITEGAKKAN = [
  "acs_dashboard:site_only",
  "acs_devices:site_only",
  "acs_mapping:site_only",
  "activity:site_only",
  "barang:department_only",
  "coupon:site_only",
  "daily_income:site_only",
  "gudang:department_only",
  "keluar:department_only",
  "list:department_only",
  "list:site_only",
  "login:site_only",
  "map:site_only",
  "masuk:department_only",
  "network:site_only",
  "opname:department_only",
  "period_income:site_only",
  "procurement:site_only",
  "profit_loss:site_only",
  "salary:department_only",
  "salary:site_only",
  "salary_users:site_only",
  "transfer:department_only",
];

describe("setiap toggle pembatasan benar-benar ditegakkan", () => {
  it("tidak ada toggle baru tanpa penegakan", () => {
    const ditegakkan = pembatasanDitegakkan();
    const tanpaPenegakan = [...toggleDiKatalog()]
      .filter((kunci) => !ditegakkan.has(kunci))
      .sort();

    const baru = tanpaPenegakan.filter(
      (kunci) => !BELUM_DITEGAKKAN.includes(kunci),
    );

    expect(baru).toEqual([]);
  });

  it("daftar utang tidak menyimpan entri yang sudah lunas", () => {
    const ditegakkan = pembatasanDitegakkan();
    const sudahDitegakkan = BELUM_DITEGAKKAN.filter((kunci) =>
      ditegakkan.has(kunci),
    );

    expect(sudahDitegakkan).toEqual([]);
  });
});

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

/**
 * Pelanggaran yang sudah ada saat penjaga ini ditulis. Keduanya utang yang
 * diakui — boleh menyusut, tidak boleh bertambah.
 */
const DIKETAHUI_TERNARY: string[] = [
  // `hasGudangSiteAccess` mengembalikan boolean, bukan filter: daftar kosong
  // menghasilkan `false` alias ditolak. Gagal-tertutup, jadi aman.
  "modules/inventory/utils/validation.ts:189",
];

const DIKETAHUI_STRING_KOSONG: string[] = [
  // `session.siteId ?? ""` lalu `.includes("")` tetap gagal-tertutup. Utangnya
  // lain: perbandingannya site tunggal, padahal daftar canvasing sudah
  // multi-site — pengguna multi-site melihat barisnya tetapi ditolak membukanya.
  "modules/marketing/services/CanvasingSiteAccessService.ts:29",
];
