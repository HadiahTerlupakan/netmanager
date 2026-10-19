import { mkdtemp, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadToR2 = vi.hoisted(() => vi.fn());
const tandaiTertunda = vi.hoisted(() => vi.fn());

vi.mock("@/lib/utils/r2-client", () => ({ uploadToR2 }));
vi.mock("@/lib/upload/upload-sync-queue", () => ({ tandaiTertunda }));

import { simpanBerkasUpload } from "@/lib/upload/mirrored-upload";

/**
 * Setiap berkas disimpan dua kali: ke R2 dan ke volume `public/uploads` yang
 * permanen. R2 yang gangguan tidak lagi menggagalkan upload, dan isi bucket
 * yang hilang masih punya salinan.
 */
const ISI = Buffer.from("foto");
const KEY_PRIVAT = "uploads/inventory/masuk/trx-1/1-trx-1_photo_1.webp";
const KEY_PUBLIK = "uploads/employee/attendance/1-absen.webp";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "mirrored-upload-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  uploadToR2.mockReset();
  tandaiTertunda.mockReset();
  tandaiTertunda.mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const salinanLokal = (key: string) => readFile(path.join(root, "public", key));

describe("simpanBerkasUpload", () => {
  it("keeps a local copy and returns the same URL as before when R2 succeeds", async () => {
    uploadToR2.mockResolvedValue(`https://cdn.radpro.id/${KEY_PRIVAT}`);

    const url = await simpanBerkasUpload(ISI, KEY_PRIVAT, "image/webp");

    expect(url).toBe(`/${KEY_PRIVAT}`);
    expect(await salinanLokal(KEY_PRIVAT)).toEqual(ISI);
    expect(tandaiTertunda).not.toHaveBeenCalled();
  });

  it("returns the CDN URL for public files when R2 succeeds", async () => {
    uploadToR2.mockResolvedValue(`https://cdn.radpro.id/${KEY_PUBLIK}`);

    const url = await simpanBerkasUpload(ISI, KEY_PUBLIK, "image/webp");

    expect(url).toBe(`https://cdn.radpro.id/${KEY_PUBLIK}`);
    expect(await salinanLokal(KEY_PUBLIK)).toEqual(ISI);
  });

  it("serves the local copy and queues a sync when R2 fails", async () => {
    uploadToR2.mockRejectedValue(new Error("R2 down"));

    const url = await simpanBerkasUpload(ISI, KEY_PUBLIK, "image/webp");

    expect(url).toBe(`/${KEY_PUBLIK}`);
    expect(await salinanLokal(KEY_PUBLIK)).toEqual(ISI);
    expect(tandaiTertunda).toHaveBeenCalledWith(KEY_PUBLIK, "image/webp");
  });

  it("still succeeds when R2 fails and the sync queue is unavailable", async () => {
    uploadToR2.mockRejectedValue(new Error("R2 down"));
    tandaiTertunda.mockRejectedValue(new Error("DB down"));

    await expect(
      simpanBerkasUpload(ISI, KEY_PRIVAT, "image/webp"),
    ).resolves.toBe(`/${KEY_PRIVAT}`);
  });

  it("fails when neither R2 nor the local volume could store the file", async () => {
    uploadToR2.mockRejectedValue(new Error("R2 down"));
    const keyKeluarVolume = "uploads/../../luar.webp";

    await expect(
      simpanBerkasUpload(ISI, keyKeluarVolume, "image/webp"),
    ).rejects.toThrow("R2 down");
  });

  it("never writes outside the uploads volume", async () => {
    uploadToR2.mockResolvedValue("https://cdn.radpro.id/x");

    await simpanBerkasUpload(ISI, "uploads/../../luar.webp", "image/webp");

    await expect(stat(path.join(root, "luar.webp"))).rejects.toThrow();
  });
});
