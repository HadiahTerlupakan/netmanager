import { describe, expect, it } from "vitest";

import {
  listWorkflowJobs,
  readBuildWorkflow,
  readDeployScript,
  readDeployScriptNumber,
  readWorkflowJob,
  stripCommentLines,
} from "../helpers/deploy-sources";

/**
 * Job `deploy` di `.github/workflows/build-image.yml` memegang satu-satunya
 * akses ke produksi: kunci SSH yang di host dikunci ke
 * `scripts/deploy/netmanager-deploy.sh` lewat forced command. Penjaga ini
 * memastikan kunci itu tetap terkurung di job tersebut, hanya dipakai setelah
 * build lulus, hanya ke host yang sidik jarinya disematkan, dan hanya untuk
 * mengirim SHA commit — bukan perintah atau manifes.
 */

const DEPLOY_JOB = "deploy";

/** Kode job deploy tanpa komentar. */
function readDeployJobCode(): string {
  return stripCommentLines(readWorkflowJob(DEPLOY_JOB));
}

/** Nama secret yang dirujuk lewat ekspresi `secrets.<NAMA>`. */
function listSecretNames(source: string): string[] {
  return [...stripCommentLines(source).matchAll(/secrets\.([A-Z_]+)/g)].map(
    (match) => match[1],
  );
}

/** Semua pemanggilan ssh sebagai satu baris logis (sambungan `\` digabung). */
function listSshInvocations(source: string): string[] {
  return stripCommentLines(source)
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /(^|\s)ssh\s/.test(line));
}

describe("job deploy GitHub", () => {
  it("DEPLOY_SSH_KEY hanya dipakai di job deploy", () => {
    const jobs = listWorkflowJobs();

    expect(jobs).toEqual(["quality", "tes", "build", DEPLOY_JOB]);
    for (const job of jobs.filter((nama) => nama !== DEPLOY_JOB)) {
      expect(listSecretNames(readWorkflowJob(job)), job).not.toContain(
        "DEPLOY_SSH_KEY",
      );
    }
    expect(listSecretNames(readWorkflowJob(DEPLOY_JOB))).toEqual([
      "DEPLOY_SSH_KEY",
    ]);
  });

  it("satu-satunya secret selain GITHUB_TOKEN adalah DEPLOY_SSH_KEY", () => {
    // Target dan known_hosts bukan rahasia, jadi disimpan sebagai variables.
    expect(new Set(listSecretNames(readBuildWorkflow()))).toEqual(
      new Set(["GITHUB_TOKEN", "DEPLOY_SSH_KEY"]),
    );
  });

  it("memakai environment production, menunggu build, dan tidak saling membatalkan", () => {
    const job = readWorkflowJob(DEPLOY_JOB);

    expect(job).toMatch(/^ {4}environment: production$/m);
    expect(job).toMatch(/^ {4}needs: build$/m);
    expect(job).toMatch(
      /^ {4}concurrency:\n {6}group: deploy-production\n {6}cancel-in-progress: false$/m,
    );
  });

  it("job build yang ditunggu deploy memang menunggu quality dan semua shard tes", () => {
    expect(readWorkflowJob("build")).toMatch(/^ {4}needs: \[quality, tes\]$/m);
  });

  it("hanya terhubung ke host yang sidik jarinya disematkan", () => {
    const kode = readDeployJobCode();

    expect(kode).toContain("StrictHostKeyChecking=yes");
    expect(kode).not.toMatch(/StrictHostKeyChecking=(no|accept-new)/);
    expect(kode).not.toContain("ssh-keyscan");
    expect(kode).toContain(
      "printf '%s\\n' \"${KNOWN_HOSTS_DEPLOY}\" > ~/.ssh/known_hosts",
    );
    expect(kode).toContain(
      "KNOWN_HOSTS_DEPLOY: ${{ vars.DEPLOY_KNOWN_HOSTS }}",
    );
  });

  it("SSH hanya mengirim SHA commit", () => {
    // Forced command di host mengabaikan apa pun selain token pertama, tetapi
    // workflow tetap tidak boleh mencoba mengirim perintah atau manifes.
    const panggilan = listSshInvocations(readBuildWorkflow());

    expect(panggilan).toHaveLength(1);
    const argumen = panggilan[0].split(/\s+/);
    expect(argumen.slice(-2)).toEqual([
      '"${TARGET_DEPLOY}"',
      '"${GITHUB_SHA}"',
    ]);
    expect(panggilan[0]).toContain("-o BatchMode=yes");
    expect(panggilan[0]).toContain("-o IdentitiesOnly=yes");
    // Tidak ada masukan stdin (manifes, skrip) yang dialirkan ke host.
    expect(panggilan[0]).not.toMatch(/[<|]/);
    expect(readDeployJobCode()).not.toMatch(/\bscp\b|\brsync\b|kubectl/);
  });

  it("tidak menjalankan kode repo selagi memegang kunci", () => {
    expect(readDeployJobCode()).not.toContain("actions/checkout");
    expect(readDeployJobCode()).not.toMatch(/\bnpm\b|\bnpx\b/);
  });

  it("menghapus kunci SSH bahkan ketika deploy gagal", () => {
    expect(readDeployJobCode()).toMatch(
      /- name: Hapus kunci SSH\n\s+if: always\(\)\n\s+run: rm -f ~\/\.ssh\/deploy/,
    );
  });

  it("tidak pernah mencetak kunci", () => {
    const kode = readDeployJobCode();

    expect(kode).not.toMatch(/echo\s+["']?\$\{?KUNCI_DEPLOY/);
    expect(kode).toContain(
      "printf '%s\\n' \"${KUNCI_DEPLOY}\" > ~/.ssh/deploy",
    );
    expect(kode).not.toMatch(/set -[a-z]*x/);
  });
});

describe("Deploy tahan putus koneksi", () => {
  it("skrip melepaskan diri dari sesi SSH dan mencatat log permanen", () => {
    // Job GitHub yang dibatalkan atau kena batas waktu memutus SSH. Tanpa
    // pelepasan ini skrip ikut mati — bisa di tengah apply setelah migrasi.
    const skrip = readDeployScript();

    expect(skrip).toContain('NETMANAGER_DEPLOY_TERLEPAS=1 setsid -w "$0"');
    expect(skrip).toContain('> "${BERKAS_LOG}" 2>&1 < /dev/null &');
    expect(skrip).toContain('tail --pid="${PID_DEPLOY}"');
    expect(skrip).toContain('wait "${PID_DEPLOY}"');
    // Pelepasan harus terjadi setelah masukan divalidasi, sebelum apa pun
    // menyentuh cluster.
    expect(skrip.indexOf("setsid -w")).toBeGreaterThan(
      skrip.indexOf("Masukan harus SHA commit 40 karakter"),
    );
    expect(skrip.indexOf("setsid -w")).toBeLessThan(skrip.indexOf("flock 9"));
  });

  it("batas waktu job deploy lebih lama dari waktu terburuk skrip", () => {
    const menit = Number(
      readWorkflowJob("deploy").match(/timeout-minutes: (\d+)/)?.[1],
    );
    const tungguMigrasi = readDeployScriptNumber("BATAS_TUNGGU_MIGRASI_DETIK");
    const rollout =
      4 * Number(readDeployScript().match(/BATAS_ROLLOUT="(\d+)s"/)?.[1]);

    expect(menit * 60).toBeGreaterThan(tungguMigrasi + rollout);
  });
});
