import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PREFLIGHT_STEP = "      - name: Periksa secret deploy";
const CHECKOUT_STEP = "      - name: Ambil kode dari Gitea";

function readWorkflow(): string {
  return readFileSync(
    resolve(process.cwd(), ".gitea/workflows/deploy-production.yml"),
    "utf8",
  );
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

/** Ambil blok step preflight saja, sampai step berikutnya di indentasi sama. */
function readPreflightBlock(): string {
  const quality = readJobBlock("quality");
  const start = quality.indexOf(PREFLIGHT_STEP);
  expect(start).toBeGreaterThanOrEqual(0);

  const rest = quality.slice(start + PREFLIGHT_STEP.length);
  const nextStep = rest.indexOf("\n      - name:");

  return nextStep === -1 ? rest : rest.slice(0, nextStep);
}

describe("Deploy secret preflight safety", () => {
  it("runs before anything is checked out or built", () => {
    const quality = readJobBlock("quality");

    // Posisinya di paling depan justru supaya salah konfigurasi terbaca dalam
    // hitungan detik, bukan setelah build 23-65 menit selesai.
    const preflightIndex = quality.indexOf(PREFLIGHT_STEP);
    const checkoutIndex = quality.indexOf(CHECKOUT_STEP);

    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(checkoutIndex).toBeGreaterThan(preflightIndex);
  });

  it("keeps the deploy private key out of the quality job", () => {
    // Job ini menjalankan lint, typecheck, dan tes. Menarik DEPLOY_SSH_KEY ke
    // sini berarti kunci privat produksi hadir di environment yang menjalankan
    // kode pihak ketiga; kunci itu harus tetap terkurung di job deploy.
    const preflight = readPreflightBlock();

    expect(preflight).toContain("SSH_TARGET: ${{ secrets.DEPLOY_SSH_TARGET }}");
    expect(preflight).toContain(
      "KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}",
    );
    // Yang menyuntikkan kunci adalah ekspresinya, bukan penyebutan namanya —
    // komentar yang menjelaskan pengecualian ini justru harus tetap boleh ada.
    expect(readJobBlock("quality")).not.toContain("secrets.DEPLOY_SSH_KEY");
    expect(readJobBlock("deploy")).toContain("secrets.DEPLOY_SSH_KEY");
  });

  it("rejects a target that is not user@host", () => {
    // Kegagalan nyata: nama secret tersalin ke kolom nilainya, sehingga SSH
    // mencoba me-resolve "deploy_ssh_target" sebagai hostname.
    const preflight = readPreflightBlock();

    expect(preflight).toContain("DEPLOY_SSH_TARGET tidak berbentuk user@host");
    expect(preflight).toContain("*@*)");
  });

  it("probes the target host so a stale address fails fast", () => {
    // Kegagalan nyata: target masih menunjuk IP server lama dan menggantung
    // sampai TCP timeout di langkah SSH pertama job deploy.
    const preflight = readPreflightBlock();

    expect(preflight).toContain("/dev/tcp/${host}/22");
    expect(preflight).toContain("Host tujuan tidak menjawab di port 22");
  });

  it("requires known_hosts to cover the target host", () => {
    const preflight = readPreflightBlock();

    expect(preflight).toContain(
      "DEPLOY_KNOWN_HOSTS tidak memuat entri untuk host tujuan",
    );
  });

  it("never echoes secret values", () => {
    // Pesan kegagalan menyebut nama secret, bukan isinya — log Gitea sudah
    // terbukti tidak selalu menyamarkan nilai secret.
    const preflight = readPreflightBlock();

    expect(preflight).not.toMatch(/echo\s+["']?\$\{?(SSH_TARGET|KNOWN_HOSTS)/);
    expect(preflight).toContain('echo "Secret deploy lolos pemeriksaan"');
  });
});
