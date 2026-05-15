import { createHash } from "crypto";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";

import { AppUpdateValidationError } from "../errors";
import type { AppUpdateAsset } from "../domain/entities/AppUpdateEntity";

const APP_UPDATE_BASE = ["public", "uploads", "app-updates"] as const;

/** Resolve absolute root directory tempat bundle Expo Updates disimpan. */
export function getAppUpdateRoot(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ...APP_UPDATE_BASE);
}

/** Resolve directory untuk satu update tertentu, terisolasi per id. */
export function getUpdateDir(id: string): string {
  return path.join(getAppUpdateRoot(), id);
}

/** Hitung SHA-256 hex dari file path tanpa load full ke memori. */
export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** Pindahkan/copy file ke tujuan, pastikan parent dir ada. */
export async function persistFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

/** Hapus directory update beserta seluruh isinya. */
export async function deleteUpdateDir(id: string): Promise<void> {
  if (!id || id.includes("..") || id.includes("/")) {
    throw new AppUpdateValidationError("ID update tidak valid");
  }
  const dir = getUpdateDir(id);
  await fs.rm(dir, { recursive: true, force: true });
}

/** Cari file berdasarkan asset hash di update directory. */
export function resolveAssetPath(updateId: string, hash: string): string {
  return path.join(getUpdateDir(updateId), "assets", hash);
}

/** Cari file bundle utama (.hbc atau .js) di update directory. */
export function resolveBundlePath(
  updateId: string,
  bundleHash: string,
): string {
  return path.join(getUpdateDir(updateId), "bundles", bundleHash);
}

/** Hash + size util untuk asset list. */
export async function buildAssetEntry(input: {
  filePath: string;
  ext: string;
  contentType: string;
  destinationRelative: string;
}): Promise<AppUpdateAsset> {
  const stat = await fs.stat(input.filePath);
  const hash = await computeFileSha256(input.filePath);
  return {
    hash,
    ext: input.ext,
    contentType: input.contentType,
    path: input.destinationRelative,
    size: stat.size,
  };
}
