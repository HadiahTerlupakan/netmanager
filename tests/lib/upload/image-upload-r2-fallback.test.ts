import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({
  isR2Enabled: vi.fn(),
  uploadToR2: vi.fn(),
  deleteFromR2: vi.fn(),
  getR2Settings: vi.fn(),
}));
const tandaiTertunda = vi.hoisted(() => vi.fn());
const hapusTertunda = vi.hoisted(() => vi.fn());

vi.mock("@/lib/utils/r2-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/r2-client")>()),
  ...r2,
}));
vi.mock("@/lib/upload/upload-sync-queue", () => ({
  tandaiTertunda,
  hapusTertunda,
}));

import {
  convertAndSaveImage,
  deleteUploadedFile,
  saveFile,
} from "@/lib/utils/image-upload";

/** Fitur yang mengunggah gambar tidak boleh gagal hanya karena R2 gangguan. */
let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "image-upload-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  r2.isR2Enabled.mockResolvedValue(true);
  r2.uploadToR2.mockRejectedValue(new Error("R2 down"));
  tandaiTertunda.mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const lokal = (url: string) => readFile(path.join(root, "public", url));

describe("upload saat R2 gangguan", () => {
  it("saves an image locally and returns a servable /uploads path", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const file = new File([new Uint8Array(png)], "a.png", {
      type: "image/png",
    });

    const url = await convertAndSaveImage(
      file,
      "public/uploads/inventory/masuk/trx-1",
      "trx-1_photo_1",
      "inventory-masuk",
      "trx-1",
    );

    expect(url).toMatch(
      /^\/uploads\/inventory\/masuk\/trx-1\/\d+-trx-1_photo_1\.webp$/,
    );
    expect((await lokal(url)).length).toBeGreaterThan(0);
  });

  it("saves a document locally and returns a servable /uploads path", async () => {
    const file = new File(["%PDF"], "surat.pdf", { type: "application/pdf" });

    const url = await saveFile(
      file,
      "public/uploads/general",
      "surat.pdf",
      "general",
    );

    expect(url).toMatch(/^\/uploads\/\d+-surat\.pdf$/);
    expect((await lokal(url)).toString()).toBe("%PDF");
  });
});

describe("hapus berkas yang punya salinan lokal", () => {
  it("removes the local copy too, so a deleted file is no longer served", async () => {
    r2.uploadToR2.mockImplementation(
      async (_isi: Buffer, key: string) => `https://cdn.radpro.id/${key}`,
    );
    r2.getR2Settings.mockResolvedValue({ publicUrl: "https://cdn.radpro.id" });
    r2.deleteFromR2.mockResolvedValue(true);
    const file = new File(["foto"], "absen.webp", { type: "image/webp" });
    const url = await saveFile(
      file,
      "public/uploads/employee/attendance",
      "absen.webp",
      "employee-attendance",
    );
    const keyTersimpan = new URL(url).pathname.slice(1);
    expect((await lokal(`/${keyTersimpan}`)).toString()).toBe("foto");

    expect(await deleteUploadedFile(url)).toBe(true);

    expect(r2.deleteFromR2).toHaveBeenCalledWith(keyTersimpan);
    await expect(lokal(`/${keyTersimpan}`)).rejects.toThrow();
  });
});

describe("hapus berkas yang dirujuk lewat jalur aplikasi", () => {
  async function unggahSaatR2Gagal() {
    const file = new File(["%PDF"], "ktp.pdf", { type: "application/pdf" });
    return saveFile(file, "public/uploads/general", "ktp.pdf", "general");
  }

  it("removes a file stored while R2 was down and keeps it from being synced later", async () => {
    const jalur = await unggahSaatR2Gagal();
    r2.deleteFromR2.mockResolvedValue(false);

    const deleted = await deleteUploadedFile(`https://admin.radpro.id${jalur}`);

    expect(deleted).toBe(true);
    await expect(lokal(jalur)).rejects.toThrow();
    expect(hapusTertunda).toHaveBeenCalledWith(jalur.slice(1));
  });

  it("removes a private file from R2 and from the local copy", async () => {
    r2.uploadToR2.mockImplementation(
      async (_isi: Buffer, key: string) => `https://cdn.radpro.id/${key}`,
    );
    const file = new File(["%PDF"], "ktp.pdf", { type: "application/pdf" });
    const jalur = await saveFile(
      file,
      "public/uploads/marketing",
      "ktp.pdf",
      "marketing",
    );
    r2.deleteFromR2.mockResolvedValue(true);

    expect(await deleteUploadedFile(`https://admin.radpro.id${jalur}`)).toBe(
      true,
    );

    expect(r2.deleteFromR2).toHaveBeenCalledWith(jalur.slice(1));
    await expect(lokal(jalur)).rejects.toThrow();
  });
});
