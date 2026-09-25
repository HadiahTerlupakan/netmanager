import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Semua langkah workflow dan skrip deploy berjalan dengan `set -o pipefail`.
 * Dalam mode itu,
 * perintah yang berhenti membaca lebih awal — `grep -q` di kecocokan pertama,
 * `head` setelah beberapa baris — membuat penulis di sisi kiri pipa kena
 * SIGPIPE (exit 141), dan pipefail menganggap seluruh pipa gagal.
 *
 * Arah kegagalannya bergantung pada tempatnya. Setelah `||`, pemeriksaan yang
 * seharusnya lolos malah menolak. Di dalam `if`, pemeriksaan yang seharusnya
 * menolak malah lolos — dan di skrip deploy itulah preflight kesehatan node
 * (`if printf "$NODE" | grep -Eq "Ready=False|DiskPressure=True"`) berada.
 *
 * Yang dipindai: workflow GitHub Actions dan skrip deploy produksi. Workflow
 * Gitea yang dulu dipindai sudah dihapus; logika deploy-nya kini ada di
 * `scripts/deploy/`.
 *
 * Cacat ini ditemukan saat build Android di repo mobile menolak AAB yang
 * bertanda tangan benar karena `printf "$SERTIFIKAT" | grep -q`.
 */

/** Direktori yang dipindai beserta akhiran berkasnya. */
const SUMBER_DIPINDAI = [
  { dir: ".github/workflows", akhiran: ".yml" },
  { dir: "scripts/deploy", akhiran: ".sh" },
];

function barisBerpola(isi: string, pola: RegExp): string[] {
  return isi
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("#"))
    .filter((baris) => pola.test(baris));
}

describe("pipefail safety in CI workflows and deploy scripts", () => {
  const workflows = SUMBER_DIPINDAI.flatMap(({ dir, akhiran }) =>
    readdirSync(resolve(process.cwd(), dir))
      .filter((nama) => nama.endsWith(akhiran))
      .map((nama) => ({
        nama: join(dir, nama),
        isi: readFileSync(resolve(process.cwd(), dir, nama), "utf8"),
      })),
  );

  it("memindai setiap direktori sumber, bukan lolos karena kosong", () => {
    for (const { dir } of SUMBER_DIPINDAI) {
      expect(
        workflows.some(({ nama }) => nama.startsWith(`${dir}/`)),
        dir,
      ).toBe(true);
    }
    expect(workflows.map(({ nama }) => nama)).toContain(
      "scripts/deploy/netmanager-deploy.sh",
    );
    expect(workflows.map(({ nama }) => nama)).toContain(
      ".github/workflows/build-image.yml",
    );
  });

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
