import fs from "node:fs";
import path from "node:path";
import type { exec } from "node:child_process";

import { logger } from "@/lib/logger";
import type { BackupBackfillResult } from "./backupService";
import { findTsxCommand } from "./backupService";

type ExecAsync = typeof exec.__promisify__;

/** Run the tenant backfill script used after database restore operations. */
export async function runTenantBackfillJob(
  execAsync: ExecAsync,
): Promise<BackupBackfillResult> {
  const scriptPath = getBackfillScriptPath();
  ensureBackfillScriptExists(scriptPath);

  try {
    const { stdout, stderr } = await execAsync(
      buildBackfillCommand(scriptPath),
    );
    logBackfillErrorOutput(stderr);
    return buildBackfillResult(stdout);
  } catch (error) {
    const commandError = error as Error & { stdout?: string; stderr?: string };
    const stdout = commandError.stdout || "";
    const stderr = commandError.stderr || "";

    if (stdout.includes("Optional failures:")) {
      logBackfillErrorOutput(stderr);
      return buildBackfillResult(stdout);
    }

    throw error;
  }
}

function getBackfillScriptPath() {
  return path.join(process.cwd(), "scripts", "backfill-tenant.ts");
}

function ensureBackfillScriptExists(scriptPath: string) {
  if (fs.existsSync(scriptPath)) return;
  throw new Error("Script backfill-tenant.ts tidak ditemukan");
}

function buildBackfillCommand(scriptPath: string) {
  return `cd ${process.cwd()} && ${findTsxCommand()} ${scriptPath}`;
}

function logBackfillErrorOutput(stderr: string) {
  if (!stderr || !stderr.toLowerCase().includes("error")) return;
  logger.error("[backup:backfill] Script Error details:", stderr);
}

function buildBackfillResult(log: string): BackupBackfillResult {
  return {
    success: true,
    message:
      "Sinkronisasi berhasil dijalankan. Data telah dihubungkan dengan Tenant yang benar.",
    log,
  };
}
