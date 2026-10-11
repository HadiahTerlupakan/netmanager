import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Penyimpan berkas dokumen planning harus memilih jalur sesuai tipe berkas.
 *
 * `convertAndSaveImage` menjalankan sharp dan menulis WebP. Melewatkan PDF ke
 * sana bukan sekadar gagal — kalau toh lolos, hasilnya WebP dan dokumennya
 * hancur tanpa pesan. PDF harus lewat `saveFile`, yang menyimpan byte-nya apa
 * adanya.
 */

const unggah = vi.hoisted(() => ({
  convertAndSaveImage: vi.fn(),
  saveFile: vi.fn(),
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: unggah.convertAndSaveImage,
  saveFile: unggah.saveFile,
}));

import { simpanGambarPlanning } from "@/modules/planning/services/PlanningDocumentService";

function berkas(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("simpanGambarPlanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unggah.convertAndSaveImage.mockResolvedValue("/uploads/a.webp");
    unggah.saveFile.mockResolvedValue("/uploads/a.pdf");
  });

  it("mengirim gambar ke konversi WebP", async () => {
    await simpanGambarPlanning(
      berkas("odp.jpg", "image/jpeg"),
      "plan-1",
      "tenant-1",
    );

    expect(unggah.convertAndSaveImage).toHaveBeenCalledTimes(1);
    expect(unggah.saveFile).not.toHaveBeenCalled();
  });

  it("mengirim PDF ke penyimpan apa adanya, bukan ke sharp", async () => {
    await simpanGambarPlanning(
      berkas("izin.pdf", "application/pdf"),
      "plan-1",
      "tenant-1",
    );

    expect(unggah.convertAndSaveImage).not.toHaveBeenCalled();
    expect(unggah.saveFile).toHaveBeenCalledTimes(1);
  });

  it("nama berkas PDF berakhiran .pdf dan memakai namespace tenant yang sama", async () => {
    await simpanGambarPlanning(
      berkas("izin.pdf", "application/pdf"),
      "plan-1",
      "tenant-1",
    );

    const [, direktori, namaBerkas, jenisUnggah, subFolder] =
      unggah.saveFile.mock.calls[0];
    // Tanpa ekstensi, berkas tersimpan tanpa tipe yang bisa dikenali browser.
    expect(namaBerkas).toMatch(/\.pdf$/);
    expect(direktori).toContain("tenant-1");
    expect(direktori).toContain("plan-1");
    // `uploadType` "planning" wajib: `generateR2Key` tanpa case yang cocok
    // diam-diam membuang `subFolder`.
    expect(jenisUnggah).toBe("planning");
    expect(subFolder).toBe("plan-1");
  });

  it("gambar dan PDF memakai direktori yang sama", async () => {
    await simpanGambarPlanning(
      berkas("odp.jpg", "image/jpeg"),
      "plan-1",
      "tenant-1",
    );
    await simpanGambarPlanning(
      berkas("izin.pdf", "application/pdf"),
      "plan-1",
      "tenant-1",
    );

    expect(unggah.saveFile.mock.calls[0][1]).toBe(
      unggah.convertAndSaveImage.mock.calls[0][1],
    );
  });
});
