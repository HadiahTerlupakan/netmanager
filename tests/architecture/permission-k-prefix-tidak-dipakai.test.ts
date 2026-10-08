import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

/**
 * Tidak ada satu pun permission berawalan `k_` yang pernah dibuat.
 *
 * Seed hanya membuat resource tanpa awalan (web) dan berawalan `m_` (mobile);
 * basis data lokal maupun produksi tidak punya satu baris pun berawalan `k_`.
 * Nama itu peninggalan konvensi "karyawan" yang tidak pernah jadi.
 *
 * Bahayanya bukan sekadar nama mati: bila sebuah pemeriksaan otorisasi *hanya*
 * bergantung padanya, ia selalu bernilai false dan pembatasan yang dikiranya
 * aktif tidak pernah menyala. Persis itu yang terjadi pada
 * `isInventorySiteRestricted` — toggle "Batasi ke Site Sendiri" menyala di panel
 * admin sementara teknisi tetap bisa menarik stok dari gudang site lain, dan
 * tidak ada tes yang gagal karena tesnya ikut memakai nama yang sama.
 *
 * `lib/permission-aliases.ts` dan `lib/resource-capabilities.ts` dikecualikan:
 * di sanalah nama lama dipetakan dan didokumentasikan, jadi keduanya memang
 * harus menyebutnya.
 */

const DIPINDAI = ["app", "modules", "lib"];
const DIKECUALIKAN = new Set([
  "lib/permission-aliases.ts",
  "lib/resource-capabilities.ts",
]);
const EKSTENSI = /\.tsx?$/;

/**
 * Permission berawalan `k_` yang ditulis sebagai literal string.
 *
 * Hanya tanda kutip lurus, bukan backtick: komentar memakai backtick untuk
 * menyebut nama lama saat menjelaskan kenapa nama itu ditinggalkan, dan itu
 * justru dokumentasi yang ingin dipertahankan.
 */
const POLA_PERMISSION = /["']k_[a-z_]+:[a-z_]+["']/;

function kumpulkanBerkas(direktori: string, hasil: string[] = []): string[] {
  for (const entri of readdirSync(direktori, { withFileTypes: true })) {
    const jalur = join(direktori, entri.name);
    if (entri.isDirectory()) {
      if (entri.name === "node_modules" || entri.name.startsWith(".")) continue;
      kumpulkanBerkas(jalur, hasil);
    } else if (EKSTENSI.test(entri.name)) {
      hasil.push(jalur);
    }
  }
  return hasil;
}

describe("permission berawalan k_ tidak dipakai kode produksi", () => {
  it("tidak ada rujukan k_ di app/, modules/, dan lib/", () => {
    const akar = process.cwd();
    const pelanggar = DIPINDAI.flatMap((direktori) =>
      kumpulkanBerkas(join(akar, direktori)),
    )
      .map((jalur) => relative(akar, jalur))
      .filter((jalur) => !DIKECUALIKAN.has(jalur))
      .filter((jalur) =>
        POLA_PERMISSION.test(readFileSync(join(akar, jalur), "utf8")),
      );

    expect(pelanggar).toEqual([]);
  });
});
