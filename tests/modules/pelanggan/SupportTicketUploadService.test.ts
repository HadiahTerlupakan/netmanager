import { describe, expect, it, vi } from "vitest";

import { SupportTicketUploadService } from "@/modules/pelanggan";

function fileWithBytes(
  bytes: number[],
  opts: { name?: string; type?: string } = {},
): File {
  const buffer = new Uint8Array(bytes);
  const blob = new Blob([buffer], { type: opts.type ?? "image/png" });
  return new File([blob], opts.name ?? "photo.png", {
    type: opts.type ?? "image/png",
  });
}

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47];

describe("SupportTicketUploadService", () => {
  it("menolak file kosong", async () => {
    const service = new SupportTicketUploadService();

    const result = await service.upload(null);

    expect(result).toEqual({
      ok: false,
      message: "No file uploaded",
      status: 400,
    });
  });

  it("menolak tipe file non gambar yang diizinkan", async () => {
    const service = new SupportTicketUploadService();

    const result = await service.upload(
      fileWithBytes([0x25, 0x50, 0x44, 0x46], {
        name: "doc.pdf",
        type: "application/pdf",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.",
      status: 400,
    });
  });

  it("menolak file melebihi batas 5MB", async () => {
    const service = new SupportTicketUploadService();
    const bigBytes = new Uint8Array(6 * 1024 * 1024);
    bigBytes.set(PNG_BYTES, 0);
    const blob = new Blob([bigBytes], { type: "image/png" });
    const file = new File([blob], "big.png", { type: "image/png" });

    const result = await service.upload(file);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/5MB/i);
  });

  it("menolak file dengan MIME image/png tapi bytes bukan PNG (spoofed)", async () => {
    const service = new SupportTicketUploadService();
    const spoofed = fileWithBytes([0x4d, 0x5a, 0x90, 0x00], {
      name: "malware.png",
      type: "image/png",
    });

    const result = await service.upload(spoofed);

    expect(result).toEqual({
      ok: false,
      message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.",
      status: 400,
    });
  });

  it("menyimpan gambar ticket dan mengembalikan payload upload", async () => {
    const saveImage = vi
      .fn()
      .mockResolvedValue("/uploads/tickets/upload-id.webp");
    const service = new SupportTicketUploadService({
      createId: () => "upload-id",
      saveImage,
    });
    const file = fileWithBytes(PNG_BYTES, {
      name: "bukti.png",
      type: "image/png",
    });

    const result = await service.upload(file);

    expect(saveImage).toHaveBeenCalledWith(
      file,
      "public/uploads/tickets",
      "upload-id",
      "tickets",
    );
    expect(result).toEqual({
      ok: true,
      data: {
        url: "/uploads/tickets/upload-id.webp",
        fileName: "upload-id.webp",
        originalName: "bukti.png",
      },
    });
  });
});
