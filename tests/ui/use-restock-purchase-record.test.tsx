// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";
import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";

const mocks = vi.hoisted(() => ({
  postWithAuth: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(() => "loading-id"),
  toastDismiss: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  postWithAuth: (...args: unknown[]) => mocks.postWithAuth(...args),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    loading: mocks.toastLoading,
    dismiss: mocks.toastDismiss,
  },
}));

import {
  useRestockPurchaseRecord,
  type RestockPurchaseRecordState,
} from "@/app/admin/inventory/restock/useRestockPurchaseRecord";

const REQUEST: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "APPROVED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", status: "DRAFT" },
  purchaseRecords: [],
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      orderedQuantity: 10,
      receivedQuantity: 0,
      purchaseOrderItemId: "poi-1",
      purchasedQuantity: 0,
      barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let fetchData: ReturnType<typeof vi.fn>;
const latest: { current: RestockPurchaseRecordState | null } = {
  current: null,
};

/** Isi hook sesudah render terakhir. */
function current(): RestockPurchaseRecordState {
  if (!latest.current) throw new Error("Hook belum dirender");
  return latest.current;
}

function Harness(): null {
  const value = useRestockPurchaseRecord({
    fetchData: fetchData as () => Promise<void>,
  });
  useEffect(() => {
    latest.current = value;
  });
  return null;
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function openFilledForm() {
  act(() => current().open(REQUEST));
  act(() => {
    current().setStoreName("Toko A");
    current().selectAll();
  });
}

function attachPhotos(urls: string[] | Error) {
  const uploadPhotos =
    urls instanceof Error
      ? vi.fn().mockRejectedValue(urls)
      : vi.fn().mockResolvedValue(urls);
  const photoUpload: PhotoUploadRef = {
    uploadPhotos,
    getPhotos: () => [{ preview: "x" } as never],
    resetPhotos: vi.fn(),
  };
  current().photoUploadRef.current = photoUpload;
  return uploadPhotos;
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchData = vi.fn().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useRestockPurchaseRecord", () => {
  it("menyimpan belanja, menampilkan pesan server, lalu menutup dan memuat ulang", async () => {
    mocks.postWithAuth.mockResolvedValue(
      jsonResponse(201, { message: "Tersimpan. Semua barang sudah dibeli." }),
    );
    openFilledForm();

    await act(() => current().submit());

    expect(mocks.postWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/purchases",
      expect.objectContaining({
        storeName: "Toko A",
        fotoNota: [],
        items: [
          { purchaseOrderItemId: "poi-1", quantity: 10, unitPrice: null },
        ],
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Tersimpan. Semua barang sudah dibeli.",
    );
    expect(current().request).toBeNull();
    expect(fetchData).toHaveBeenCalled();
  });

  it("menampilkan masalah isian tanpa mengirim apa pun", async () => {
    act(() => current().open(REQUEST));
    expect(current().problems).toEqual([]);

    await act(() => current().submit());

    expect(mocks.postWithAuth).not.toHaveBeenCalled();
    expect(current().problems).toContain(
      "Nama toko belum diisi. Tulis nama tokonya.",
    );
  });

  it.each([404, 409])(
    "menutup dan memuat ulang bila server menjawab %i",
    async (status) => {
      mocks.postWithAuth.mockResolvedValue(
        jsonResponse(status, { error: "Pesanan ini baru saja diubah." }),
      );
      openFilledForm();

      await act(() => current().submit());

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Pesanan ini baru saja diubah.",
        expect.anything(),
      );
      expect(current().request).toBeNull();
      expect(fetchData).toHaveBeenCalled();
    },
  );

  it("tetap membuka isian bila server menolak isinya (400)", async () => {
    mocks.postWithAuth.mockResolvedValue(
      jsonResponse(400, { error: "Kabel Fiber sudah dibeli semua." }),
    );
    openFilledForm();

    await act(() => current().submit());

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Kabel Fiber sudah dibeli semua.",
      expect.anything(),
    );
    expect(current().request).not.toBeNull();
    expect(fetchData).not.toHaveBeenCalled();
    expect(current().isSubmitting).toBe(false);
  });

  it("mengunggah foto nota lebih dulu, lalu mengirim alamatnya", async () => {
    mocks.postWithAuth.mockResolvedValue(jsonResponse(201, { message: "ok" }));
    openFilledForm();
    const uploadPhotos = attachPhotos(["/uploads/nota.jpg"]);

    await act(() => current().submit());

    expect(uploadPhotos).toHaveBeenCalled();
    expect(mocks.toastLoading).toHaveBeenCalledWith(
      "Sedang mengunggah foto...",
    );
    expect(mocks.postWithAuth).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fotoNota: ["/uploads/nota.jpg"] }),
    );
  });

  it("tidak mengirim belanja bila unggah foto gagal", async () => {
    openFilledForm();
    attachPhotos(new Error("Foto gagal diunggah."));

    await act(() => current().submit());

    expect(mocks.postWithAuth).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Foto gagal diunggah.",
      expect.anything(),
    );
    expect(current().request).not.toBeNull();
  });

  it("tidak mengunggah ulang foto yang sudah terunggah saat simpan dicoba lagi", async () => {
    mocks.postWithAuth.mockResolvedValue(
      jsonResponse(400, { error: "Nama toko terlalu panjang." }),
    );
    openFilledForm();
    let photos: Array<{ preview: string; status: string; url?: string }> = [
      { preview: "x", status: "pending" },
    ];
    const uploadPhotos = vi.fn(async () => {
      photos = [{ preview: "x", status: "success", url: "/uploads/nota.jpg" }];
      return ["/uploads/nota.jpg"];
    });
    current().photoUploadRef.current = {
      uploadPhotos,
      getPhotos: () => photos as never,
      resetPhotos: vi.fn(),
    };

    await act(() => current().submit());
    await act(() => current().submit());

    expect(uploadPhotos).toHaveBeenCalledTimes(1);
    expect(mocks.postWithAuth).toHaveBeenCalledTimes(2);
    expect(mocks.postWithAuth).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ fotoNota: ["/uploads/nota.jpg"] }),
    );
  });
});
