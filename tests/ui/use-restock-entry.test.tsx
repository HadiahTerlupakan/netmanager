// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

const mockPatchWithAuth = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/api-client", () => ({
  patchWithAuth: (...args: unknown[]) => mockPatchWithAuth(...args),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    loading: vi.fn(() => "loading-toast"),
    dismiss: vi.fn(),
  },
}));

import {
  type RestockEntryState,
  useRestockEntry,
} from "@/app/admin/inventory/restock/useRestockEntry";

const PHOTO_URL = "https://cdn.radpro.id/uploads/inventory/masuk/bukti.webp";

function makeItem(
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem {
  return {
    id: "item-1",
    barangId: "fiber",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

function makeRequest(items: PurchaseRequestItem[]): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", status: "DRAFT" },
    items,
  };
}

const fiberAndOnt = makeRequest([
  makeItem(),
  makeItem({
    id: "item-2",
    barangId: "ont",
    jumlah: 5,
    orderedQuantity: 5,
    receivedQuantity: 2,
    barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
  }),
]);

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function respond(status: number, body: unknown): FakeResponse {
  return { ok: status < 400, status, json: async () => body };
}

function makePhotoUpload(): PhotoUploadRef {
  return {
    uploadPhotos: vi.fn(async () => [PHOTO_URL]),
    getPhotos: () => [],
    resetPhotos: () => {},
  };
}

let container: HTMLDivElement;
let root: Root;
/**
 * Hasil hook terakhir. Ditugaskan di dalam efek, bukan saat render, supaya
 * render tetap murni; `act` menjamin efeknya sudah jalan sebelum tes membaca.
 */
const holder: { state?: RestockEntryState } = {};

function current(): RestockEntryState {
  if (!holder.state) throw new Error("Hook belum dirender");
  return holder.state;
}
const fetchData = vi.fn(async () => {});

function Harness(): null {
  const state = useRestockEntry({ fetchData, barangs: [] });
  useEffect(() => {
    holder.state = state;
  });
  return null;
}

/** Buka modal, pasang PhotoUpload palsu, dan pilih satu foto. */
function openWithPhoto(request: PurchaseRequest): PhotoUploadRef {
  const photoUpload = makePhotoUpload();
  act(() => current().open(request));
  current().photoUploadRef.current = photoUpload;
  act(() => current().setPhotos([{ preview: "x" } as never]));
  return photoUpload;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  mockPatchWithAuth.mockReset();
  mockToastSuccess.mockClear();
  mockToastError.mockClear();
  fetchData.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useRestockEntry", () => {
  it("mengisi jumlah awal dengan sisa milik pengajuan dan mengosongkan isian lain", () => {
    act(() => current().setSubstitutions({ fiber: "lama" }));
    act(() => current().setOverReceipts({ fiber: "lama" }));
    act(() => current().open(fiberAndOnt));

    expect(current().request).toBe(fiberAndOnt);
    expect(current().receivedItems).toEqual({ fiber: 10, ont: 3 });
    expect(current().substitutions).toEqual({});
    expect(current().overReceipts).toEqual({});
    expect(current().photos).toEqual([]);
  });

  it("tidak menyimpan tanpa foto bila ada barang yang masuk", async () => {
    act(() => current().open(fiberAndOnt));

    await act(async () => current().submit());

    expect(mockPatchWithAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Belum bisa disimpan:\nFoto barang yang sampai dulu.",
      expect.anything(),
    );
  });

  it("mengunggah foto, mengirim jumlah per baris, lalu menutup dan memuat ulang", async () => {
    mockPatchWithAuth.mockResolvedValue(
      respond(200, {
        data: { id: "grn-1" },
        purchaseRequestStatus: "RECEIVED",
      }),
    );
    const photoUpload = openWithPhoto(fiberAndOnt);

    await act(async () => current().submit());

    expect(photoUpload.uploadPhotos).toHaveBeenCalledTimes(1);
    expect(mockPatchWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/receive",
      {
        items: { fiber: 10, ont: 3 },
        substitutions: {},
        overReceipts: {},
        fotoBukti: [PHOTO_URL],
      },
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Laporan tersimpan. Semua barang sudah sampai dan masuk stok gudang.",
    );
    expect(current().request).toBeNull();
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it("menyebut barang yang tidak dimasukkan di toast sukses", async () => {
    mockPatchWithAuth.mockResolvedValue(respond(200, { data: null }));
    openWithPhoto(fiberAndOnt);
    act(() => current().setReceivedItems({ fiber: 6, ont: 3 }));

    await act(async () => current().submit());

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Laporan tersimpan. Barang yang sampai sudah masuk stok gudang. Tidak sampai: Kabel Fiber 4 roll.",
    );
  });

  it("menyelesaikan data lama tanpa barang tambahan tanpa mengunggah foto", async () => {
    mockPatchWithAuth.mockResolvedValue(respond(200, { data: null }));
    const legacy = makeRequest([makeItem({ receivedQuantity: 4 })]);
    const photoUpload = openWithPhoto(legacy);
    act(() => current().setReceivedItems({ fiber: 0 }));

    await act(async () => current().submit());

    expect(photoUpload.uploadPhotos).not.toHaveBeenCalled();
    expect(mockPatchWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/receive",
      {
        items: { fiber: 0 },
        substitutions: {},
        overReceipts: {},
        fotoBukti: [],
      },
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Tersimpan. Pengajuan selesai tanpa barang tambahan.",
    );
  });

  it.each([400, 404, 409])(
    "menutup modal dan memuat ulang bila data di server sudah berubah (%i)",
    async (status) => {
      mockPatchWithAuth.mockResolvedValue(
        respond(status, {
          error: "Pengajuan ini baru saja diubah. Muat ulang halaman.",
        }),
      );
      openWithPhoto(fiberAndOnt);

      await act(async () => current().submit());

      expect(mockToastError).toHaveBeenCalledWith(
        "Pengajuan ini baru saja diubah. Muat ulang halaman.",
        expect.anything(),
      );
      expect(current().request).toBeNull();
      expect(fetchData).toHaveBeenCalledTimes(1);
    },
  );

  it("membiarkan modal terbuka untuk penolakan lain", async () => {
    mockPatchWithAuth.mockResolvedValue(
      respond(403, { error: "Anda tidak punya izin memasukkan barang." }),
    );
    openWithPhoto(fiberAndOnt);

    await act(async () => current().submit());

    expect(mockToastError).toHaveBeenCalledWith(
      "Anda tidak punya izin memasukkan barang.",
      expect.anything(),
    );
    expect(current().request).toBe(fiberAndOnt);
    expect(current().isSubmitting).toBe(false);
    expect(fetchData).not.toHaveBeenCalled();
  });
});
