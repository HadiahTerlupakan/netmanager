import { describe, expect, it, vi } from "vitest";

import { InventoryPhotoUploadService } from "@/modules/inventory";

function createFile(input: { size?: number; type?: string } = {}) {
  const size = input.size ?? 1000;
  return new File(["x".repeat(size)], "photo.png", {
    type: input.type ?? "image/png",
  });
}

describe("InventoryPhotoUploadService", () => {
  it("menolak transaksi tanpa identifier", async () => {
    const service = new InventoryPhotoUploadService();

    const result = await service.upload({
      photos: [createFile()],
      transactionId: "",
      transactionType: "inventory-masuk",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: { error: "ID Transaksi wajib disertakan" },
    });
  });

  it("menolak transaksi inventory yang tidak ditemukan", async () => {
    const routeService = {
      verifyInventoryTransaction: vi.fn().mockResolvedValue(null),
    };
    const service = new InventoryPhotoUploadService({ routeService });

    const result = await service.upload({
      photos: [createFile()],
      transactionId: "trx-1",
      transactionType: "inventory-keluar",
    });

    expect(routeService.verifyInventoryTransaction).toHaveBeenCalledWith({
      transactionId: "trx-1",
      transactionType: "inventory-keluar",
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      body: { error: "Transaksi barang keluar tidak ditemukan" },
    });
  });

  it("mengunggah foto valid dan mengembalikan payload sukses", async () => {
    const uploadPhotos = vi
      .fn()
      .mockResolvedValue(["/uploads/inventory-masuk/2026/04/trx_photo_1.webp"]);
    const service = new InventoryPhotoUploadService({
      now: () => new Date("2026-04-27T00:00:00.000Z"),
      cwd: () => "/repo",
      routeService: {
        verifyInventoryTransaction: vi.fn().mockResolvedValue({ id: "trx-1" }),
      },
      uploadPhotos,
      validatePhotos: () => ({ isValid: true, errors: [] }),
    });
    const photos = [createFile()];

    const result = await service.upload({
      photos,
      transactionId: "trx-1",
      transactionType: "inventory-masuk",
    });

    expect(uploadPhotos).toHaveBeenCalledWith(
      photos,
      "trx-1",
      "inventory-masuk",
      "/repo/public/uploads/inventory-masuk/2026/04",
    );
    expect(result).toEqual({
      ok: true,
      body: {
        success: true,
        message: "1 photo(s) uploaded successfully",
        data: {
          urls: ["/uploads/inventory-masuk/2026/04/trx_photo_1.webp"],
          transactionId: "trx-1",
          transactionType: "inventory-masuk",
          count: 1,
        },
      },
    });
  });
});
