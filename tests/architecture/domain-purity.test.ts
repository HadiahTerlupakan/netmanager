import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * `modules/<x>/domain/` tidak boleh import apa pun dari luar dirinya — tanpa
 * Prisma, tanpa framework, tanpa alias `@/`. Aturannya ada di
 * `docs/architecture/clean-architecture.md`.
 *
 * Versi sebelumnya memeriksanya dengan satu regex ber-flag `m`:
 *
 *   /^import .* from ["'](?!\.)([^"']+)["'];?/m
 *
 * `.` tidak cocok dengan newline, sehingga pola itu hanya melihat impor yang
 * seluruhnya ada di SATU baris. Setiap impor berbentuk daftar — yang justru
 * bentuk paling lazim ketika beberapa tipe ditarik sekaligus — lolos tanpa
 * terlihat:
 *
 *   import type {
 *     Gudang,
 *   } from "@prisma/client";   // ← tidak pernah terbaca
 *
 * Tiga pelanggaran nyata bersembunyi di sana sampai 2026-10-12. Pemeriksaan
 * sekarang menormalkan dulu setiap pernyataan impor menjadi satu baris, lalu
 * membaca sumbernya — jadi bentuk daftar maupun satu baris diperlakukan sama.
 */

const collectTypeScriptFiles = (directory: string): string[] => {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory())
      return collectTypeScriptFiles(entryPath);
    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
};

const domainFiles = collectTypeScriptFiles(join(process.cwd(), "modules"))
  .filter((filePath) => filePath.includes(`${join("modules", "")}`))
  .filter((filePath) => filePath.includes(`/domain/`));

/**
 * Sumber setiap pernyataan `import` pada sebuah berkas, apa pun bentuknya.
 *
 * Komentar blok dibuang lebih dulu supaya contoh kode di dalam docstring
 * tidak ikut terhitung sebagai impor sungguhan.
 */
function sumberImpor(source: string): string[] {
  const tanpaKomentar = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const pola = /^[ \t]*import\b[\s\S]*?from\s*["']([^"']+)["']/gm;
  return Array.from(tanpaKomentar.matchAll(pola), (cocok) => cocok[1]);
}

/** Impor non-relatif: bukan `./x` maupun `../x`. */
function nonRelatif(sumber: string[]): string[] {
  return sumber.filter((modul) => !modul.startsWith("."));
}

/**
 * Pelanggaran yang sudah ada sebelum pemeriksaan ini diperketat, dengan
 * alasan masing-masing. Daftar ini HANYA boleh menyusut.
 *
 * Tes di bawah menuntut himpunan pelanggaran sama persis dengan daftar ini,
 * jadi ia bicara dua arah: pelanggaran baru menggagalkannya, dan memperbaiki
 * salah satu entri juga menggagalkannya sampai entrinya dicabut dari sini.
 * Tanpa itu, memperketat regex berarti menjatuhkan suite sampai migrasi
 * inventory selesai — dan tes yang dimatikan tidak menjaga apa pun.
 */
const UTANG_DIKETAHUI: Record<string, string> = {
  // Migrasi inventory berhenti di langkah 2 dari 5 panduan Clean Architecture
  // (`docs/architecture/clean-architecture.md`): `IInventoryOperationRepository`
  // sudah pindah ke `domain/ports/`, tapi return type-nya masih model Prisma
  // (`Gudang`, `Barang`, `BarangMasuk`, `BarangKeluar`, dan
  // `Prisma.TransactionClient`). Mencabut impornya menuntut domain entity +
  // mapper untuk seluruh modul inventory — pekerjaan tersendiri, bukan
  // tempelan di tes ini.
  "modules/inventory/domain/ports/IInventoryOperationRepository.ts":
    "port masih memakai model Prisma; menunggu langkah 3 migrasi inventory",
  "modules/inventory/domain/ports/IInventoryOperationRepository.types.ts":
    "tipe komposit di atas model Prisma; menunggu langkah 3 migrasi inventory",
};

describe("domain layer purity", () => {
  it.each(domainFiles)("does not import external modules in %s", (filePath) => {
    const jalurRelatif = relative(process.cwd(), filePath).split(sep).join("/");
    const pelanggaran = nonRelatif(sumberImpor(readFileSync(filePath, "utf8")));

    if (UTANG_DIKETAHUI[jalurRelatif]) {
      // Utang yang sudah dicatat: tuntut ia MASIH melanggar. Begitu benar-benar
      // diperbaiki, tes ini gagal dan memaksa entrinya dicabut dari
      // `UTANG_DIKETAHUI` — daftarnya tidak bisa membusuk dalam diam.
      expect(
        pelanggaran,
        `${jalurRelatif} sudah bersih — cabut entrinya dari UTANG_DIKETAHUI`,
      ).not.toEqual([]);
      return;
    }

    expect(
      pelanggaran,
      `${jalurRelatif} mengimpor dari luar domain: ${pelanggaran.join(", ")}`,
    ).toEqual([]);
  });

  it("menangkap impor berbentuk daftar, bukan hanya satu baris", () => {
    // Regex lama ber-flag `m` dengan `.*` tidak pernah melewati newline, jadi
    // bentuk pertama di bawah lolos sepenuhnya. Ini yang membuat tiga
    // pelanggaran bertahan tanpa terlihat.
    const berbentukDaftar = [
      "import type {",
      "  Gudang,",
      '} from "@prisma/client";',
    ].join("\n");

    expect(nonRelatif(sumberImpor(berbentukDaftar))).toEqual([
      "@prisma/client",
    ]);
    expect(nonRelatif(sumberImpor('import { a } from "@/lib/x";'))).toEqual([
      "@/lib/x",
    ]);
    expect(nonRelatif(sumberImpor('import { a } from "./x";'))).toEqual([]);
    expect(
      nonRelatif(sumberImpor('import type { A } from "../entities/A";')),
    ).toEqual([]);
  });

  it("tidak menghitung contoh impor di dalam komentar blok", () => {
    const docstring = [
      "/**",
      ' * import { x } from "@prisma/client";',
      " */",
      'import { y } from "./y";',
    ].join("\n");

    expect(nonRelatif(sumberImpor(docstring))).toEqual([]);
  });
});
