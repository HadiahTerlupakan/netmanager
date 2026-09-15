import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Semua langkah workflow berjalan dengan `set -o pipefail`. Dalam mode itu,
 * perintah yang berhenti membaca lebih awal — `grep -q` di kecocokan pertama,
 * `head` setelah beberapa baris — membuat penulis di sisi kiri pipa kena
 * SIGPIPE (exit 141), dan pipefail menganggap seluruh pipa gagal.
 *
 * Arah kegagalannya bergantung pada tempatnya. Setelah `||`, pemeriksaan yang
 * seharusnya lolos malah menolak. Di dalam `if`, pemeriksaan yang seharusnya
 * menolak malah lolos — dan di workflow deploy itulah preflight kesehatan node
 * (`if printf "$NODE" | grep -Eq "Ready=False|DiskPressure=True"`) berada.
 *
 * Cacat ini ditemukan saat build Android di repo mobile menolak AAB yang
 * bertanda tangan benar karena `printf "$SERTIFIKAT" | grep -q`.
 */

const WORKFLOW_DIR = resolve(process.cwd(), ".gitea/workflows");

function barisBerpola(isi: string, pola: RegExp): string[] {
  return isi
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("#"))
    .filter((baris) => pola.test(baris));
}

describe("pipefail safety in Gitea workflows", () => {
  const workflows = readdirSync(WORKFLOW_DIR)
    .filter((nama) => nama.endsWith(".yml"))
    .map((nama) => ({
      nama,
      isi: readFileSync(join(WORKFLOW_DIR, nama), "utf8"),
    }));

  it("never ends a pipe with grep -q", () => {
    for (const { nama, isi } of workflows) {
      expect({
        nama,
        baris: barisBerpola(isi, /\|\s*grep\s+-[a-zA-Z]*q/),
      }).toEqual({ nama, baris: [] });
    }
  });

  it("never truncates a pipe with head", () => {
    for (const { nama, isi } of workflows) {
      expect({ nama, baris: barisBerpola(isi, /\|\s*head\b/) }).toEqual({
        nama,
        baris: [],
      });
    }
  });

  it("proves the here-string form works where the pipe form fails", () => {
    const jalankan = (skrip: string): string => {
      try {
        execFileSync("bash", [
          "-c",
          `set -o pipefail; teks="$(printf 'Ready=False\\n'; seq 200000)"; ${skrip}`,
        ]);
        return "lolos";
      } catch {
        return "gagal";
      }
    };

    expect(jalankan(`printf '%s\\n' "$teks" | grep -Eq 'Ready=False'`)).toBe(
      "gagal",
    );
    expect(jalankan(`grep -Eq 'Ready=False' <<< "$teks"`)).toBe("lolos");
  });
});
