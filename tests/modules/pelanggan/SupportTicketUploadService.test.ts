import { describe, expect, it, vi } from "vitest";

import { SupportTicketUploadService } from "@/modules/pelanggan";

function createFile(
  input: { name?: string; size?: number; type?: string } = {},
) {
  return {
    name: input.name ?? "photo.png",
    size: input.size ?? 1000,
    type: input.type ?? "image/png",
  } as File;
}

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
      createFile({ type: "application/pdf" }),
    );

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
    const file = createFile({ name: "bukti.png" });

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
