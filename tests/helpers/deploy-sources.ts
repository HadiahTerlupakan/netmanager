import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Pembaca bersama untuk tes penjaga CI/CD: skrip deploy yang berjalan di host
 * produksi dan workflow GitHub yang memanggilnya. Tes-tes ini memeriksa isi
 * berkas, jadi potongan yang diperiksa harus sesempit mungkin supaya sebuah
 * asersi tidak tertolong teks dari langkah lain.
 */

export const DEPLOY_SCRIPT_PATH = "scripts/deploy/netmanager-deploy.sh";
export const BUILD_WORKFLOW_PATH = ".github/workflows/build-image.yml";

/** Isi berkas relatif terhadap akar repo. */
export function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/** Isi utuh skrip deploy produksi. */
export function readDeployScript(): string {
  return readProjectFile(DEPLOY_SCRIPT_PATH);
}

/** Isi utuh workflow GitHub Actions (quality, tes, build, deploy). */
export function readBuildWorkflow(): string {
  return readProjectFile(BUILD_WORKFLOW_PATH);
}

/** Buang baris komentar, supaya asersi hanya menilai kode yang dijalankan. */
export function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

/**
 * Satu bagian skrip deploy, dari judul `# --- <label>` sampai judul bagian
 * berikutnya. Label cukup awalannya, misalnya "5." atau "Masukan".
 */
export function readDeployScriptSection(label: string): string {
  const script = readDeployScript();
  const header = `\n# --- ${label}`;
  const start = script.indexOf(header);
  if (start < 0) throw new Error(`Bagian skrip "${label}" tidak ditemukan`);

  const rest = script.slice(start + 1);
  const next = rest.indexOf("\n# --- ", 1);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Posisi judul bagian skrip deploy, untuk memeriksa urutan langkah. */
export function deployScriptSectionIndex(label: string): number {
  const index = readDeployScript().indexOf(`\n# --- ${label}`);
  if (index < 0) throw new Error(`Bagian skrip "${label}" tidak ditemukan`);
  return index;
}

/** Nilai konstanta numerik `NAMA=123` di skrip deploy. */
export function readDeployScriptNumber(name: string): number {
  const match = readDeployScript().match(new RegExp(`^${name}=(\\d+)$`, "m"));
  if (!match) throw new Error(`Konstanta ${name} tidak ditemukan`);
  return Number(match[1]);
}

/** Blok satu job workflow: dari header `  <nama>:` sampai header job berikutnya. */
export function readWorkflowJob(jobName: string): string {
  const workflow = readBuildWorkflow();
  const start = workflow.indexOf(`\n  ${jobName}:\n`);
  if (start < 0) throw new Error(`Job ${jobName} tidak ditemukan`);

  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** Nama semua job di workflow, sesuai urutan kemunculan. */
export function listWorkflowJobs(): string[] {
  const jobs = readBuildWorkflow().split("\njobs:\n")[1] ?? "";
  return [...jobs.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((match) => match[1]);
}

export interface BashResult {
  isSuccess: boolean;
  stdout: string;
}

/**
 * Batas waktu potongan bash: loop yang seharusnya berhenti tidak boleh
 * menggantung tes. Di bawah batas bawaan vitest (5 detik) supaya yang
 * terlapor adalah asersi gagal, bukan tes yang kehabisan waktu.
 */
const BASH_TIMEOUT_MS = 4_000;

/**
 * Jalankan potongan bash dengan env tambahan; kegagalan (termasuk melewati
 * batas waktu) dikembalikan, bukan dilempar. Env induk sengaja tidak
 * diwariskan selain PATH (NODE_ENV hanya karena diwajibkan tipe ProcessEnv),
 * supaya variabel seperti SSH_ORIGINAL_COMMAND milik mesin penguji tidak ikut
 * memengaruhi hasil.
 */
export function runBash(script: string, env: Record<string, string> = {}): BashResult {
  try {
    const stdout = execFileSync("bash", ["-c", script], {
      encoding: "utf8",
      env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: BASH_TIMEOUT_MS,
    });
    return { isSuccess: true, stdout };
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? "";
    return { isSuccess: false, stdout };
  }
}
