import { describe, expect, it } from "vitest";

import {
  listWorkflowJobs,
  readBuildWorkflow,
  readWorkflowJob,
  stripCommentLines,
} from "../helpers/deploy-sources";

/**
 * Workflow GitHub menjalankan seluruh CI/CD: quality, tes, build image, lalu
 * deploy. Akses ke produksi (kunci SSH) hanya ada di job `deploy` — dijaga di
 * `github-deploy-job-safety`. Berkas ini menjaga job-job lainnya: tidak
 * memegang akses produksi, memasang dependensi secara deterministik, dan
 * hanya membangun image setelah semua pemeriksaan lulus.
 */

const JOB_TANPA_AKSES_PRODUKSI = ["quality", "tes", "build"];
const JOB_PEMASANG_DEPENDENSI = ["quality", "tes"];
const PERINTAH_INSTALL = "npm ci --no-audit --prefer-offline --ignore-scripts";

describe("workflow build GitHub", () => {
  it("job selain deploy tidak memegang akses apa pun ke produksi", () => {
    expect(listWorkflowJobs()).toEqual([...JOB_TANPA_AKSES_PRODUKSI, "deploy"]);
    for (const job of JOB_TANPA_AKSES_PRODUKSI) {
      // Komentar boleh menjelaskan kubectl/SSH; yang diperiksa hanya isi kerja.
      const kode = stripCommentLines(readWorkflowJob(job));

      expect(kode, job).not.toMatch(/secrets\.DEPLOY_|vars\.DEPLOY_/);
      expect(kode, job).not.toContain("kubectl");
      expect(kode, job).not.toMatch(/\bssh\b/);
      // Satu-satunya secret yang boleh dipakai adalah token bawaan GitHub.
      for (const [, nama] of kode.matchAll(/secrets\.([A-Z_]+)/g)) {
        expect(nama, job).toBe("GITHUB_TOKEN");
      }
    }
  });

  it("izin bawaan hanya baca; hak tulis package hanya untuk job build", () => {
    const workflow = readBuildWorkflow();

    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    for (const job of listWorkflowJobs().filter((nama) => nama !== "build")) {
      expect(readWorkflowJob(job), job).not.toContain("packages: write");
    }
    expect(readWorkflowJob("build")).toContain("packages: write");
  });

  it("image hanya dibangun setelah quality dan semua shard tes lulus", () => {
    expect(readWorkflowJob("build")).toMatch(/^ {4}needs: \[quality, tes\]$/m);
  });

  it("tidak dipicu event yang membawa kode dari luar", () => {
    const workflow = readBuildWorkflow();

    expect(workflow).not.toContain("pull_request");
    expect(workflow).not.toContain("repository_dispatch");
  });

  it("tag image bisa dihitung ulang skrip deploy dari commit yang sama", () => {
    // Pasangannya di skrip deploy dijaga di deploy-script-safety.
    expect(readWorkflowJob("build")).toContain(
      'VERSION="$(echo "${GITHUB_SHA}" | cut -c1-12)-$(git show -s --format=%ct HEAD)"',
    );
  });

  it("build aplikasi memakai secret dummy dan melewati typecheck ganda", () => {
    const build = readWorkflowJob("build");

    expect(build).toContain(
      "NEXTAUTH_SECRET=ci-build-dummy-secret-at-least-32-chars",
    );
    expect(build).toContain("SKIP_TS_CHECK=true");
  });

  it("meneruskan revisi git ke image aplikasi", () => {
    const build = readWorkflowJob("build");

    expect(build).toContain("IMAGE_REVISION=${{ github.sha }}");
    expect(build).toContain(
      "labels: org.opencontainers.image.revision=${{ github.sha }}",
    );
  });

  it("memindai secret pada commit yang didorong sebelum apa pun dipasang", () => {
    const quality = readWorkflowJob("quality");
    const pindai = quality.indexOf("zricethezav/gitleaks:");

    expect(pindai).toBeGreaterThan(-1);
    expect(quality).toContain("fetch-depth: 0");
    expect(quality).toContain('--log-opts="${RENTANG}"');
    expect(pindai).toBeLessThan(quality.indexOf("npm ci"));
  });

  it("memasang dependensi secara deterministik tanpa fallback npm install", () => {
    expect(stripCommentLines(readBuildWorkflow())).not.toContain("npm install");
    for (const job of JOB_PEMASANG_DEPENDENSI) {
      expect(readWorkflowJob(job), job).toContain(PERINTAH_INSTALL);
    }
  });

  it("men-generate Prisma client eksplisit setelah install, bukan lewat postinstall", () => {
    // `--ignore-scripts` mematikan postinstall, jadi generate harus dipanggil
    // sendiri. Versi paralelnya sengaja tidak dipakai: puncak pemakaian RAM-nya
    // menjatuhkan job.
    for (const job of JOB_PEMASANG_DEPENDENSI) {
      const blok = readWorkflowJob(job);
      const indeksInstall = blok.indexOf(PERINTAH_INSTALL);

      expect(indeksInstall, job).toBeGreaterThan(-1);
      expect(blok.indexOf("npm run prisma:generate"), job).toBeGreaterThan(indeksInstall);
    }
    expect(readBuildWorkflow()).not.toContain("prisma:generate-parallel");
  });

  it("quality menjalankan lint dan typecheck", () => {
    const quality = readWorkflowJob("quality");

    expect(quality).toContain("npm run lint");
    expect(quality).toContain("npm run typecheck");
  });

  it("tes unit berjalan di semua shard tanpa ada berkas yang terlewat", () => {
    const tes = readWorkflowJob("tes");
    const daftarShard = tes.match(/shard: \[([\d, ]+)\]/);
    const jumlahShard = tes.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/);

    expect(daftarShard).not.toBeNull();
    expect(jumlahShard).not.toBeNull();
    const shard = daftarShard![1].split(",").map((nilai) => Number(nilai.trim()));
    const total = Number(jumlahShard![1]);
    // Setiap indeks 1..total harus punya runner; shard yang hilang berarti
    // sebagian berkas tes diam-diam tidak pernah dijalankan.
    expect(shard).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(tes).toContain("fail-fast: false");
  });
});
