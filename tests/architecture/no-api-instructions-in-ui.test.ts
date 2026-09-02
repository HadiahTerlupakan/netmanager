import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { globSync } from "glob";
import { join } from "path";

const ROOT = join(__dirname, "../..");

/**
 * Halaman admin dipakai oleh manajer proyek dan staf lapangan, bukan developer.
 * Menyuruh mereka "POST /api/..." bukan instruksi -- itu jalan buntu yang
 * terlihat seperti petunjuk.
 *
 * Kasus nyata yang memicu tes ini: tab Dokumen pada detail Planning OSP
 * menampilkan "Upload dokumen via API: POST /api/planning/{id}/documents",
 * padahal endpoint tersebut melempar notImplemented.
 */
const HTTP_METHOD_INSTRUCTION = /(?:GET|POST|PUT|PATCH|DELETE)\s+\/api\//;

describe("halaman admin tidak menyuruh pengguna memanggil API mentah", () => {
  it("tidak ada teks berisi metode HTTP + path /api/ di UI admin", () => {
    const files = globSync("app/admin/**/*.tsx", { cwd: ROOT });
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");

      source.split("\n").forEach((line, index) => {
        // Abaikan komentar kode -- yang dilarang adalah teks yang dirender.
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
          return;
        }
        // Abaikan pemanggilan fetch yang memang berisi path API.
        if (/fetch\(|axios|router\.(push|replace)/.test(line)) {
          return;
        }
        if (HTTP_METHOD_INSTRUCTION.test(line)) {
          offenders.push(`${file}:${index + 1} → ${trimmed}`);
        }
      });
    }

    expect(
      offenders,
      `Teks berikut menyuruh pengguna memanggil API secara manual:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
