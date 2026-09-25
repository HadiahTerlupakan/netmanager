import { describe, expect, it } from "vitest";

import {
  deployScriptSectionIndex,
  readDeployScript,
  readDeployScriptNumber,
  readDeployScriptSection,
} from "../helpers/deploy-sources";

/**
 * Jaminan-jaminan di berkas ini dulu hidup di `Jenkinsfile`, lalu di workflow
 * Gitea `deploy-production.yml`, dan kini di skrip deploy yang berjalan di host
 * produksi (`scripts/deploy/netmanager-deploy.sh`). Setiap kali pipeline
 * pindah rumah, jaminan ini pernah tertinggal: workflow Gitea awalnya langsung
 * menerapkan Job migrasi tanpa memeriksa node, tanpa memastikan secret live
 * sudah nyata, dan tanpa cadangan basis data sama sekali. Berkas ini yang
 * menahan agar perpindahan berikutnya tidak diam-diam menghapus jaringan
 * pengamannya.
 *
 * Semua yang diperiksa di sini berjalan tepat sebelum migrasi menulis ke basis
 * data produksi, yaitu titik yang paling mahal untuk diulang bila salah.
 */

const PREFLIGHT = "5.";
const BACKUP = "6.";
const MIGRATION = "7.";

function readPreflight(): string {
  return readDeployScriptSection(PREFLIGHT);
}

function readBackup(): string {
  return readDeployScriptSection(BACKUP);
}

describe("Preflight produksi sebelum migrasi", () => {
  it("membatalkan perubahan ketika ada node Ready=False atau DiskPressure=True", () => {
    // Migrasi di atas node yang sedang sekarat berisiko terpotong di tengah,
    // dan migrasi yang terpotong jauh lebih mahal daripada deploy tertunda.
    const preflight = readPreflight();

    expect(preflight).toContain("kubectl get nodes");
    // here-string, bukan pipa: lihat tests/ci/pipefail-safety.
    expect(preflight).toContain(
      'if grep -Eq "Ready=False|DiskPressure=True" <<< "${NODE}"; then',
    );
    expect(preflight).toContain('gagal "Node produksi tidak sehat');
  });

  it("gagal() benar-benar menghentikan skrip", () => {
    expect(readDeployScript()).toMatch(/gagal\(\) \{\n[^}]*\n {2}exit 1\n\}/);
  });

  it("mencetak kondisi node saat menolak, bukan hanya pesan gagal", () => {
    const preflight = readPreflight();

    expect(preflight).toContain("kubectl describe nodes");
    expect(preflight).toContain("kubectl top nodes");
  });

  it("menolak deploy ketika secret pull registry belum ada di namespace", () => {
    // Tanpa secret ini rollout tetap "berhasil" dijadwalkan lalu tertahan di
    // ImagePullBackOff — gagal yang tidak terlihat di langkah apply.
    const preflight = readPreflight();

    expect(preflight).toContain('get secret "${NAMESPACE}-registry"');
    expect(preflight).toContain('|| gagal "Secret pull registry');
  });

  it("menolak deploy ketika secret live masih placeholder atau kosong", () => {
    const preflight = readPreflight();

    expect(preflight).toContain("{.data.CRON_SECRET}");
    // Nilai kosong adalah kondisi yang paling mudah lolos diam-diam, jadi
    // pemeriksaannya ditulis terpisah dan eksplisit.
    expect(preflight).toContain(
      'if [ -z "${NILAI_CRON}" ] || [ "${NILAI_CRON}" = "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY" ]; then',
    );
    expect(preflight).toContain('gagal "CRON_SECRET');
  });

  it("berjalan sebelum apa pun diterapkan ke cluster", () => {
    expect(deployScriptSectionIndex(PREFLIGHT)).toBeLessThan(
      deployScriptSectionIndex(MIGRATION),
    );
    expect(readDeployScript().indexOf(" apply -f ")).toBeGreaterThan(
      deployScriptSectionIndex(MIGRATION),
    );
  });
});

describe("Cadangan database sebelum migrasi", () => {
  it("mencadangkan keempat database produksi, bukan hanya yang utama", () => {
    // Migrasi menyentuh netmanager, radius, billing, dan mitra. Mencadangkan
    // satu saja berarti tiga basis data lain berjalan tanpa jaring.
    expect(readBackup()).toContain(
      "for NAMA_URL in DATABASE_URL RADIUS_DATABASE_URL DATABASE_URL_BILLING DATABASE_URL_MITRA; do",
    );
  });

  it("membuang query string Prisma yang ditolak libpq", () => {
    // URL billing dan mitra membawa `?schema=public&connection_limit=...`.
    // Prisma menerimanya, libpq menolaknya dengan "invalid URI query
    // parameter", sehingga pg_dump gagal untuk dua basis data itu.
    expect(readBackup()).toContain('sed \\"s/?.*//\\"');
  });

  it("tidak memipa pg_dump sama sekali agar status keluarnya terbaca", () => {
    // `sh -c 'pg_dump ... | gzip'` mengembalikan status gzip, bukan pg_dump,
    // sehingga dump yang gagal tetap terlihat sukses. Kompresi dilakukan di
    // luar pod supaya status keluar kubectl exec adalah status pg_dump.
    const backup = readBackup();
    const barisExec = backup
      .split("\n")
      .find((baris) => baris.includes("exec deployment/netmanager-app"));

    expect(barisExec).toBeDefined();

    // Skrip pod berakhir di tanda kutip ganda pertama yang tidak di-escape.
    const bagian = barisExec!.match(/sh -c "((?:[^"\\]|\\.)*)"(.*)$/);

    expect(bagian).not.toBeNull();

    const [, skripPod, sesudahPod] = bagian!;

    expect(skripPod).toContain("pg_dump");
    expect(skripPod).not.toContain("gzip");
    // Setelah skrip pod ditutup tidak ada pipa, sehingga status keluar
    // kubectl exec adalah status pg_dump dan bukan status perintah lain.
    expect(sesudahPod).toMatch(/^ > "\$\{MENTAH\}"; then$/);
    // Kompresi dijalankan terpisah, dengan status keluarnya sendiri.
    expect(backup).toContain('if ! gzip -f "${MENTAH}"; then');
  });

  it("memverifikasi arsip hasilnya, bukan sekadar percaya perintahnya sukses", () => {
    const backup = readBackup();

    expect(backup).toContain('gzip -t "${BERKAS}"');
    expect(backup).toContain('-ge "${UKURAN_CADANGAN_MINIMUM}"');
    expect(readDeployScriptNumber("UKURAN_CADANGAN_MINIMUM")).toBeGreaterThan(0);
  });

  it("menggagalkan migrasi ketika cadangan gagal", () => {
    const backup = readBackup();
    const penanganan = backup.slice(
      backup.indexOf("batalkan_atau_lanjut() {"),
      backup.indexOf("\n}\n", backup.indexOf("batalkan_atau_lanjut() {")),
    );

    expect(penanganan).toContain('gagal "Cadangan pra-migrasi gagal');
    // Ketiga titik kegagalan (dump, kompresi, arsip) menuju penanganan itu.
    expect(backup.match(/batalkan_atau_lanjut "\$\{NAMA_URL\}: /g)).toHaveLength(3);
  });

  it("hanya melanjutkan tanpa cadangan lewat override manual di host", () => {
    // Dulu input workflow_dispatch; kini bendera baris perintah yang hanya
    // dihormati di luar forced command (diuji perilakunya di
    // deploy-script-safety). Pemakaiannya tetap tercatat sebagai peringatan.
    const backup = readBackup();

    expect(backup).toContain('if [ "${IZIN_TANPA_CADANGAN}" = "true" ]; then');
    expect(backup).toContain("::warning::Cadangan $1 gagal");
  });

  it("berjalan setelah preflight dan sebelum migrasi", () => {
    expect(deployScriptSectionIndex(PREFLIGHT)).toBeLessThan(
      deployScriptSectionIndex(BACKUP),
    );
    expect(deployScriptSectionIndex(BACKUP)).toBeLessThan(
      deployScriptSectionIndex(MIGRATION),
    );
  });

  it("membuang cadangan lama supaya disk produksi tidak terisi diam-diam", () => {
    const backup = readBackup();

    expect(backup).toContain(
      `find "\${DIR_CADANGAN}" -name '*.sql.gz' -mtime +"\${RETENSI_CADANGAN_HARI}" -delete`,
    );
    expect(readDeployScriptNumber("RETENSI_CADANGAN_HARI")).toBe(7);
  });
});

describe("Diagnostik kegagalan migrasi", () => {
  it("menyertakan describe job dan describe pod, bukan hanya log", () => {
    // Job yang podnya tidak pernah terjadwal (ImagePullBackOff, tekanan
    // sumber daya) tidak punya log sama sekali; `kubectl logs` pada kasus itu
    // mengembalikan kosong dan menyembunyikan penyebabnya.
    const migration = readDeployScriptSection(MIGRATION);

    expect(migration).toContain("describe job netmanager-migration-job");
    expect(migration).toContain("-l job-name=netmanager-migration-job");
    expect(migration).toContain("describe pod");
    expect(migration).toContain("--tail=100");
  });
});
