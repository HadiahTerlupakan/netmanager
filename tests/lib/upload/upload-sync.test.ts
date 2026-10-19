import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadToR2 = vi.hoisted(() => vi.fn());
const queue = vi.hoisted(() => ({
  ambilTertunda: vi.fn(),
  hapusTertunda: vi.fn(),
  catatGagalSinkron: vi.fn(),
}));

vi.mock("@/lib/utils/r2-client", () => ({ uploadToR2 }));
vi.mock("@/lib/upload/upload-sync-queue", () => queue);

import { sinkronkanUploadTertunda } from "@/lib/upload/upload-sync";

/** Berkas yang tersimpan lokal saat R2 gangguan harus menyusul ke R2. */
const KEY = "uploads/inventory/masuk/trx-1/1-trx-1_photo_1.webp";
let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "upload-sync-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  uploadToR2.mockReset();
  for (const fn of Object.values(queue)) fn.mockReset();
  queue.ambilTertunda.mockResolvedValue([
    { key: KEY, contentType: "image/webp" },
  ]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

async function tulisSalinanLokal() {
  const target = path.join(root, "public", KEY);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "foto");
}

describe("sinkronkanUploadTertunda", () => {
  it("uploads the local copy to R2 and clears it from the queue", async () => {
    await tulisSalinanLokal();
    uploadToR2.mockResolvedValue("https://cdn.radpro.id/x");

    const hasil = await sinkronkanUploadTertunda(50);

    expect(uploadToR2).toHaveBeenCalledWith(
      Buffer.from("foto"),
      KEY,
      "image/webp",
    );
    expect(queue.hapusTertunda).toHaveBeenCalledWith(KEY);
    expect(hasil).toEqual({ tersinkron: 1, gagal: 0, hilang: 0 });
  });

  it("keeps the file queued with the error when R2 still fails", async () => {
    await tulisSalinanLokal();
    uploadToR2.mockRejectedValue(new Error("R2 down"));

    const hasil = await sinkronkanUploadTertunda(50);

    expect(queue.catatGagalSinkron).toHaveBeenCalledWith(KEY, "R2 down");
    expect(queue.hapusTertunda).not.toHaveBeenCalled();
    expect(hasil).toEqual({ tersinkron: 0, gagal: 1, hilang: 0 });
  });

  it("drops a queued file whose local copy no longer exists", async () => {
    const hasil = await sinkronkanUploadTertunda(50);

    expect(uploadToR2).not.toHaveBeenCalled();
    expect(queue.hapusTertunda).toHaveBeenCalledWith(KEY);
    expect(hasil).toEqual({ tersinkron: 0, gagal: 0, hilang: 1 });
  });
});
