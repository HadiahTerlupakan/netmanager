import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Kode hasil generate tidak boleh ikut diformat perkakas gaya.
 *
 * Kejadian nyata (2026-09-21): `prisma generate` menulis impor dengan kutip
 * tunggal, sementara `lint-staged` menjalankan `prettier --write` pada tiap
 * `*.ts` yang di-stage. Salinan yang ter-commit karenanya tidak pernah sama
 * dengan keluaran generator, dan setiap `npm install` — yang memicu
 * `postinstall` -> `prisma:generate` — mengotori enam berkas dengan diff
 * 46.000 baris yang isinya HANYA gaya kutip. Derau sebesar itu menutupi
 * perubahan sungguhan di `git status`, dan sempat membuat drift ini disangka
 * ketidakcocokan versi Prisma.
 *
 * ESLint sudah mengabaikan direktori itu jauh sebelumnya; yang terlewat hanya
 * Prettier. Tes ini menjaga keduanya tetap sepakat, karena satu pihak saja
 * yang lupa sudah cukup untuk memunculkan kembali derau tersebut.
 */

const DIREKTORI_HASIL_GENERATE = "prisma/generated";

function bacaBerkasProyek(pathRelatif: string): string {
  return readFileSync(resolve(process.cwd(), pathRelatif), "utf8");
}

/** Baris bermakna dari sebuah berkas ignore — komentar dan baris kosong dibuang. */
function polaIgnore(isi: string): string[] {
  return isi
    .split("\n")
    .map((baris) => baris.trim())
    .filter((baris) => baris.length > 0 && !baris.startsWith("#"));
}

describe("kode hasil generate dibiarkan apa adanya", () => {
  it("Prettier mengabaikan client Prisma hasil generate", () => {
    const pola = polaIgnore(bacaBerkasProyek(".prettierignore"));

    expect(
      pola.some(
        (baris) => baris.replace(/\/$/, "") === DIREKTORI_HASIL_GENERATE,
      ),
    ).toBe(true);
  });

  it("ESLint mengabaikan direktori yang sama", () => {
    const konfigurasi = bacaBerkasProyek("eslint.config.mjs");

    expect(konfigurasi).toContain(`${DIREKTORI_HASIL_GENERATE}/**`);
  });

  it("isi ter-commit tetap memakai kutip tunggal khas generator", () => {
    // Penanda konkret bahwa berkas tidak diformat ulang: begitu Prettier
    // menyentuhnya, kutip tunggal ini berubah jadi kutip ganda dan diff
    // 46.000 baris itu kembali.
    const client = bacaBerkasProyek(
      `${DIREKTORI_HASIL_GENERATE}/billing/runtime/client.d.ts`,
    );

    expect(client).toContain("from '@prisma/client-runtime-utils'");
    expect(client).not.toContain('from "@prisma/client-runtime-utils"');
  });
});
