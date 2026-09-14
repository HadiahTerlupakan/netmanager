import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Jaminan-jaminan di berkas ini dulu hidup di `Jenkinsfile`. Ketika pipeline
 * pindah ke Gitea Actions, jaminan-jaminan itu tidak ikut terbawa: workflow
 * baru langsung menerapkan Job migrasi tanpa memeriksa kesehatan node, tanpa
 * memastikan secret live sudah nyata, dan tanpa cadangan basis data sama
 * sekali. Jenkinsfile lalu dihapus karena tidak lagi dipakai — berkas ini yang
 * menahan agar penghapusan itu tidak diam-diam ikut menghapus jaringan
 * pengamannya.
 *
 * Semua yang diperiksa di sini berjalan tepat sebelum migrasi menulis ke basis
 * data produksi, yaitu titik yang paling mahal untuk diulang bila salah.
 */

const WORKFLOW_PATH = ".gitea/workflows/deploy-production.yml";

const PREFLIGHT_STEP = "      - name: Preflight produksi";
const BACKUP_STEP = "      - name: Cadangkan database sebelum migrasi";
const MIGRATION_STEP = "      - name: Jalankan migrasi database";

function readWorkflow(): string {
  return readFileSync(resolve(process.cwd(), WORKFLOW_PATH), "utf8");
}

/** Ambil blok satu job dari workflow, sampai job berikutnya di indentasi sama. */
function readJobBlock(jobName: string): string {
  const workflow = readWorkflow();
  const start = workflow.indexOf(`\n  ${jobName}:\n`);
  expect(start).toBeGreaterThanOrEqual(0);

  const rest = workflow.slice(start + 1);
  const nextJob = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/);

  return nextJob === -1 ? rest : rest.slice(0, nextJob);
}

/** Ambil isi satu step deploy, sampai step berikutnya di indentasi sama. */
function readDeployStep(stepHeader: string): string {
  const deploy = readJobBlock("deploy");
  const start = deploy.indexOf(stepHeader);
  expect(start).toBeGreaterThanOrEqual(0);

  const rest = deploy.slice(start + stepHeader.length);
  const nextStep = rest.indexOf("\n      - name:");

  return nextStep === -1 ? rest : rest.slice(0, nextStep);
}

/** Posisi awal satu step di dalam job deploy, untuk memeriksa urutan. */
function deployStepIndex(stepHeader: string): number {
  const index = readJobBlock("deploy").indexOf(stepHeader);
  expect(index).toBeGreaterThanOrEqual(0);

  return index;
}

describe("Preflight produksi sebelum migrasi", () => {
  it("membatalkan perubahan ketika ada node Ready=False atau DiskPressure=True", () => {
    // Migrasi di atas node yang sedang sekarat berisiko terpotong di tengah,
    // dan migrasi yang terpotong jauh lebih mahal daripada deploy tertunda.
    const preflight = readDeployStep(PREFLIGHT_STEP);

    expect(preflight).toContain("kubectl get nodes");
    expect(preflight).toMatch(
      /grep -Eq ["']Ready=False\|DiskPressure=True["']/,
    );
    expect(preflight).toContain("exit 1");
  });

  it("mencetak kondisi node saat menolak, bukan hanya pesan gagal", () => {
    const preflight = readDeployStep(PREFLIGHT_STEP);

    expect(preflight).toContain("kubectl describe nodes");
    expect(preflight).toContain("kubectl top nodes");
  });

  it("menolak deploy ketika secret pull registry belum ada di namespace", () => {
    // Tanpa secret ini rollout tetap "berhasil" dijadwalkan lalu tertahan di
    // ImagePullBackOff — gagal yang tidak terlihat di langkah apply.
    const preflight = readDeployStep(PREFLIGHT_STEP);

    expect(preflight).toContain("get secret ${NAMESPACE}-registry");
  });

  it("menolak deploy ketika secret live masih placeholder atau kosong", () => {
    const preflight = readDeployStep(PREFLIGHT_STEP);

    expect(preflight).toContain("CRON_SECRET");
    expect(preflight).toContain("REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY");
    // Nilai kosong adalah kondisi yang paling mudah lolos diam-diam, jadi
    // pemeriksaannya ditulis terpisah dan eksplisit.
    expect(preflight).toContain("[ -n ");
  });

  it("berjalan sebelum apa pun diterapkan ke cluster", () => {
    expect(deployStepIndex(PREFLIGHT_STEP)).toBeLessThan(
      deployStepIndex(MIGRATION_STEP),
    );
  });
});

describe("Cadangan database sebelum migrasi", () => {
  it("mencadangkan keempat database produksi, bukan hanya yang utama", () => {
    // Migrasi menyentuh netmanager, radius, billing, dan mitra. Mencadangkan
    // satu saja berarti tiga basis data lain berjalan tanpa jaring.
    const backup = readDeployStep(BACKUP_STEP);

    for (const variable of [
      "DATABASE_URL",
      "RADIUS_DATABASE_URL",
      "DATABASE_URL_BILLING",
      "DATABASE_URL_MITRA",
    ]) {
      expect(backup).toContain(variable);
    }
  });

  it("membuang query string Prisma yang ditolak libpq", () => {
    // URL billing dan mitra membawa `?schema=public&connection_limit=...`.
    // Prisma menerimanya, libpq menolaknya dengan "invalid URI query
    // parameter", sehingga pg_dump gagal untuk dua basis data itu.
    const backup = readDeployStep(BACKUP_STEP);

    expect(backup).toContain('sed \\"s/?.*//\\"');
  });

  it("tidak memipa pg_dump sama sekali agar status keluarnya terbaca", () => {
    // `sh -c 'pg_dump ... | gzip'` mengembalikan status gzip, bukan pg_dump,
    // sehingga dump yang gagal tetap terlihat sukses. Kompresi dilakukan di
    // luar pod supaya status keluar kubectl exec adalah status pg_dump.
    const backup = readDeployStep(BACKUP_STEP);
    const barisExec = backup
      .split("\n")
      .find((baris) => baris.includes("exec deployment/netmanager-app"));

    expect(barisExec).toBeDefined();

    const bagian = barisExec!.match(/sh -c '(.*)'(.*)$/);

    expect(bagian).not.toBeNull();

    const [, skripPod, sesudahPod] = bagian!;

    expect(skripPod).toContain("pg_dump");
    expect(skripPod).not.toContain("gzip");
    // Setelah skrip pod ditutup tidak ada pipa, sehingga status keluar
    // kubectl exec adalah status pg_dump dan bukan status perintah lain.
    expect(sesudahPod).not.toContain("|");
    // Kompresi dijalankan terpisah, dengan status keluarnya sendiri.
    expect(backup).toContain("gzip -f");
  });

  it("memverifikasi arsip hasilnya, bukan sekadar percaya perintahnya sukses", () => {
    const backup = readDeployStep(BACKUP_STEP);

    expect(backup).toContain("gzip -t");
  });

  it("menggagalkan migrasi ketika cadangan gagal", () => {
    const backup = readDeployStep(BACKUP_STEP);

    expect(backup).toContain("::error::");
    expect(backup).toContain("exit 1");
  });

  it("hanya melanjutkan tanpa cadangan lewat override manual yang tercatat", () => {
    // Override harus berupa input workflow_dispatch: push tidak bisa
    // mengisinya, jadi deploy otomatis tidak pernah melewati cadangan, dan
    // setiap pemakaian override tercatat pada run-nya.
    const workflow = readWorkflow();
    const backup = readDeployStep(BACKUP_STEP);

    expect(workflow).toContain("allow_migration_without_backup:");
    expect(workflow).toMatch(/workflow_dispatch:\s*\n\s+inputs:/);
    expect(backup).toContain("allow_migration_without_backup");
  });

  it("berjalan setelah preflight dan sebelum migrasi", () => {
    expect(deployStepIndex(PREFLIGHT_STEP)).toBeLessThan(
      deployStepIndex(BACKUP_STEP),
    );
    expect(deployStepIndex(BACKUP_STEP)).toBeLessThan(
      deployStepIndex(MIGRATION_STEP),
    );
  });

  it("membuang cadangan lama supaya disk produksi tidak terisi diam-diam", () => {
    const backup = readDeployStep(BACKUP_STEP);

    expect(backup).toContain("-mtime +7");
    expect(backup).toContain("-delete");
  });
});

describe("Diagnostik kegagalan migrasi", () => {
  it("menyertakan describe job dan describe pod, bukan hanya log", () => {
    // Job yang podnya tidak pernah terjadwal (ImagePullBackOff, tekanan
    // sumber daya) tidak punya log sama sekali; `kubectl logs` pada kasus itu
    // mengembalikan kosong dan menyembunyikan penyebabnya.
    const migration = readDeployStep(MIGRATION_STEP);

    expect(migration).toContain("describe job netmanager-migration-job");
    expect(migration).toContain("-l job-name=netmanager-migration-job");
    expect(migration).toContain("describe pod");
    expect(migration).toContain("--tail=100");
  });
});
