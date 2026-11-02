import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTERNAL_MOBILE_RESOURCES,
  PERMISSION_GROUPS,
  PERMISSION_GROUPS_MOBILE,
} from "@/lib/permission-config";
import {
  getResourceCapabilities,
  RESOURCE_CAPABILITIES,
} from "@/lib/resource-capabilities";

/**
 * Setiap toggle "Batasi ke Site Sendiri" / "Batasi ke Departemen Sendiri" yang
 * digambar matriks role harus dibaca oleh kode backend.
 *
 * Kejadian nyata (2026-11-03): `getResourceCapabilities` jatuh ke default yang
 * memuat `site_only` + `department_only` untuk setiap resource tanpa entri
 * katalog. Akibatnya kartu Notifikasi, Accounting, Registration, Reseller, dan
 * puluhan lainnya menampilkan toggle pembatasan yang tidak dibaca siapa pun.
 * Pemilik role menyalakannya dan yakin datanya terbatas, padahal tidak.
 *
 * Penjaga pasangannya, `lingkup-site-konsisten.test.ts`, hanya memeriksa entri
 * yang tertulis di `RESOURCE_CAPABILITIES`, sehingga toggle yang datang dari
 * default lolos. Penjaga ini memeriksa apa yang benar-benar digambar matriks:
 * `getResourceCapabilities(resource)` untuk setiap resource yang dibuat seed.
 */

const SCOPE_ACTIONS = ["site_only", "department_only"] as const;
type ScopeAction = (typeof SCOPE_ACTIONS)[number];

/** Berkas yang hanya MENDEKLARASIKAN nama permission, bukan membacanya. */
const BERKAS_DEKLARASI = [
  "lib/role-templates.ts",
  "lib/permission-aliases.ts",
  "lib/permission-config.ts",
  "lib/resource-capabilities.ts",
  // Registri konstanta `PERMISSIONS.*.SITE_ONLY`; tidak dipakai untuk pembatasan.
  "lib/permissions.ts",
];

/**
 * Implementasi pembatasan itu sendiri (nama resource di sana cuma contoh) dan
 * UI matriks role (yang MENGGAMBAR toggle, bukan membacanya).
 */
const DIREKTORI_DIKECUALIKAN = [
  "lib/authorization/",
  "app/admin/settings/roles/",
];

/** Fungsi yang membaca `${resource}:site_only` dari argumen kedua. */
const PEMBACA_ARGUMEN_SITE = [
  "checkSiteRestriction",
  "getSiteFilter",
  "getSiteFilters",
  "buildMultiSiteWhereClause",
  "buildSiteWhereClause",
  "canAccessSite",
  "validateSiteAccess",
];

/** Fungsi berargumen objek `{ resource }` beserta aksi yang dibacanya. */
const PEMBACA_PROPERTI_RESOURCE: Record<string, readonly ScopeAction[]> = {
  lingkupSiteUntuk: ["site_only"],
  buildRecipientSiteScopeWhere: SCOPE_ACTIONS,
  buildSiteUnrestrictedRecipientWhere: SCOPE_ACTIONS,
  isSiteUnrestrictedRecipient: SCOPE_ACTIONS,
};

/**
 * Konvensi untuk resource yang dirakit lewat `lingkupSiteUntuk({ resource })`
 * dari parameter: konstanta bernama `*SITE_SCOPE_RESOURCE` (string atau objek
 * berisi string) memegang resource yang `:site_only`-nya dibaca. Menamai
 * konstanta lain membuat penjaga ini gagal keras, bukan diam-diam lolos.
 */
const POLA_KONSTANTA_LINGKUP_SITE =
  /\bconst\s+[A-Z_]*SITE_SCOPE_RESOURCE\s*(?::[^=]+)?=\s*("[a-z_0-9]+"|\{[^}]*\})/g;

function kumpulkanBerkas(direktori: string): string[] {
  return readdirSync(direktori).flatMap((entri) => {
    const jalur = join(direktori, entri);
    if (statSync(jalur).isDirectory()) return kumpulkanBerkas(jalur);
    return /\.tsx?$/.test(entri) ? [jalur] : [];
  });
}

function berkasBackend(): string[] {
  return ["app", "modules", "lib"]
    .flatMap(kumpulkanBerkas)
    .map((jalur) => relative(process.cwd(), jalur))
    .filter(
      (jalur) =>
        !BERKAS_DEKLARASI.includes(jalur) &&
        !DIREKTORI_DIKECUALIKAN.some((awalan) => jalur.startsWith(awalan)),
    );
}

/** Komentar dibuang: menyebut permission di komentar bukan membacanya. */
function tanpaKomentar(sumber: string): string {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** `const NAMA = "nilai"` di berkas yang sama, untuk argumen berupa konstanta. */
function konstantaString(sumber: string): Map<string, string> {
  const konstanta = new Map<string, string>();
  for (const cocok of sumber.matchAll(
    /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*"([a-z_0-9]+)"/g,
  )) {
    konstanta.set(cocok[1]!, cocok[2]!);
  }
  return konstanta;
}

function nilaiResource(
  ekspresi: string,
  konstanta: Map<string, string>,
): string | undefined {
  const teks = ekspresi.trim();
  const literal = teks.match(/^["'`]([a-z_0-9]+)["'`]$/);
  if (literal) return literal[1];
  return konstanta.get(teks);
}

/** Isi argumen tiap pemanggilan `nama(...)`, dengan kurung berimbang. */
function isiPemanggilan(sumber: string, nama: string): string[] {
  const penanda = new RegExp(`\\b${nama}\\(`, "g");
  const hasil: string[] = [];

  for (const cocok of sumber.matchAll(penanda)) {
    const awal = cocok.index! + cocok[0].length;
    let kedalaman = 1;
    let akhir = awal;
    for (; akhir < sumber.length && kedalaman > 0; akhir += 1) {
      const karakter = sumber[akhir];
      if (karakter === "(") kedalaman += 1;
      if (karakter === ")") kedalaman -= 1;
    }
    hasil.push(sumber.slice(awal, akhir - 1));
  }

  return hasil;
}

/** Argumen ke-`indeks` dari isi pemanggilan, dipisah koma pada kedalaman nol. */
function argumenKe(isi: string, indeks: number): string | undefined {
  const argumen: string[] = [];
  let kedalaman = 0;
  let kini = "";
  for (const karakter of isi) {
    if ("([{".includes(karakter)) kedalaman += 1;
    if (")]}".includes(karakter)) kedalaman -= 1;
    if (karakter === "," && kedalaman === 0) {
      argumen.push(kini);
      kini = "";
      continue;
    }
    kini += karakter;
  }
  argumen.push(kini);
  return argumen[indeks];
}

/** Semua pasangan `resource:aksi` pembatasan yang dibaca kode backend. */
function pembatasanDibaca(): Set<string> {
  const dibaca = new Set<string>();

  for (const jalur of berkasBackend()) {
    const sumber = tanpaKomentar(
      readFileSync(join(process.cwd(), jalur), "utf8"),
    );
    const konstanta = konstantaString(sumber);

    for (const aksi of SCOPE_ACTIONS) {
      for (const cocok of sumber.matchAll(
        new RegExp(`["'\`]([a-z_0-9]+):${aksi}["'\`]`, "g"),
      )) {
        dibaca.add(`${cocok[1]}:${aksi}`);
      }
      // Prisma: `{ resource: "opname", action: "site_only" }`.
      for (const cocok of sumber.matchAll(
        new RegExp(`resource:\\s*"([a-z_0-9]+)",\\s*action:\\s*"${aksi}"`, "g"),
      )) {
        dibaca.add(`${cocok[1]}:${aksi}`);
      }
    }

    for (const cocok of sumber.matchAll(POLA_KONSTANTA_LINGKUP_SITE)) {
      for (const nilai of cocok[1]!.matchAll(/"([a-z_0-9]+)"/g)) {
        dibaca.add(`${nilai[1]}:site_only`);
      }
    }

    for (const nama of PEMBACA_ARGUMEN_SITE) {
      for (const isi of isiPemanggilan(sumber, nama)) {
        const resource = nilaiResource(argumenKe(isi, 1) ?? "", konstanta);
        if (resource) dibaca.add(`${resource}:site_only`);
      }
    }

    for (const [nama, aksiDibaca] of Object.entries(
      PEMBACA_PROPERTI_RESOURCE,
    )) {
      for (const isi of isiPemanggilan(sumber, nama)) {
        const properti = isi.match(/\bresource:\s*([^,}\n]+)/);
        const resource = properti && nilaiResource(properti[1]!, konstanta);
        if (!resource) continue;
        for (const aksi of aksiDibaca) dibaca.add(`${resource}:${aksi}`);
      }
    }
  }

  return dibaca;
}

/** Resource yang digambar matriks role: sumber yang sama dengan `prisma/seed.ts`. */
function resourceDiMatriks(): string[] {
  return [
    ...new Set<string>([
      ...Object.values(PERMISSION_GROUPS).flat(),
      ...Object.values(PERMISSION_GROUPS_MOBILE).flat(),
      ...INTERNAL_MOBILE_RESOURCES,
      ...Object.keys(RESOURCE_CAPABILITIES),
    ]),
  ].sort();
}

function toggleDitawarkan(): string[] {
  return resourceDiMatriks().flatMap((resource) =>
    SCOPE_ACTIONS.filter((aksi) =>
      getResourceCapabilities(resource).includes(aksi),
    ).map((aksi) => `${resource}:${aksi}`),
  );
}

describe("matriks role hanya menawarkan toggle pembatasan yang dibaca backend", () => {
  const dibaca = pembatasanDibaca();

  it("resource tanpa entri katalog tidak mendapat toggle pembatasan", () => {
    const aksi = getResourceCapabilities("resource_tanpa_entri_katalog");

    expect(aksi).toEqual(["read", "create", "update", "delete"]);
  });

  it("setiap toggle pembatasan yang digambar dibaca kode backend", () => {
    const tanpaPembaca = toggleDitawarkan().filter(
      (kunci) => !dibaca.has(kunci),
    );

    expect(tanpaPembaca).toEqual([]);
  });

  it.each([
    "notifications",
    "accounting",
    "registration",
    "reseller",
    "m_topology",
    "salary",
    "list",
  ])("kartu %s tidak menampilkan toggle pembatasan", (resource) => {
    const pembatasan = getResourceCapabilities(resource).filter((aksi) =>
      (SCOPE_ACTIONS as readonly string[]).includes(aksi),
    );

    expect(pembatasan).toEqual([]);
  });

  it("pembatasan yang memang dibaca tetap punya toggle", () => {
    for (const kunci of [
      "workorders:site_only",
      "workorders:department_only",
      "bandwidth:site_only",
      "harga:site_only",
      "profileppp:site_only",
      "ppp:site_only",
      "invoices:site_only",
      "transactions:site_only",
    ]) {
      const [resource, aksi] = kunci.split(":") as [string, ScopeAction];
      expect(getResourceCapabilities(resource), kunci).toContain(aksi);
      expect(dibaca.has(kunci), kunci).toBe(true);
    }
  });

  it("pemindai memang menemukan pembacaan (penjaga tidak kosong)", () => {
    expect(dibaca.size).toBeGreaterThan(30);
  });
});
