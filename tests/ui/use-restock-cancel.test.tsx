// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

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
  },
}));

import {
  type RestockCancelState,
  useRestockCancel,
} from "@/app/admin/inventory/restock/useRestockCancel";
import { RESTOCK_NETWORK_ERROR_MESSAGE } from "@/app/admin/inventory/restock/utils";

const REQUEST: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "APPROVED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", status: "DRAFT" },
  items: [],
};

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function respond(status: number, body: unknown): FakeResponse {
  return { ok: status < 400, status, json: async () => body };
}

let container: HTMLDivElement;
let root: Root;
/**
 * Hasil hook terakhir. Ditugaskan di dalam efek, bukan saat render, supaya
 * render tetap murni; `act` menjamin efeknya sudah jalan sebelum tes membaca.
 */
const holder: { state?: RestockCancelState } = {};

function current(): RestockCancelState {
  if (!holder.state) throw new Error("Hook belum dirender");
  return holder.state;
}
const fetchData = vi.fn(async () => {});

function Harness(): null {
  const state = useRestockCancel({ fetchData });
  useEffect(() => {
    holder.state = state;
  });
  return null;
}

function openWithReason(reason: string) {
  act(() => current().open(REQUEST));
  act(() => current().setReason(reason));
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

describe("useRestockCancel", () => {
  it("membuka modal dengan alasan kosong", () => {
    act(() => current().setReason("sisa lama"));
    act(() => current().open(REQUEST));

    expect(current().request).toBe(REQUEST);
    expect(current().reason).toBe("");
    expect(current().errorMessage).toBeNull();
  });

  it("tidak mengirim alasan yang terlalu pendek", async () => {
    openWithReason("  ok ");

    await act(async () => current().submit());

    expect(mockPatchWithAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Tulis alasan pembatalan, paling sedikit 5 huruf.",
      expect.anything(),
    );
    expect(current().request).toBe(REQUEST);
  });

  it("membatalkan dengan alasan yang dirapikan, memuat ulang, lalu menutup", async () => {
    mockPatchWithAuth.mockResolvedValue(
      respond(200, {
        data: { id: "pr-1", status: "CANCELLED" },
        message: "Pengajuan dibatalkan.",
      }),
    );
    // Modal masih terbuka selama daftar dimuat ulang, supaya fokus bisa
    // kembali ke tombol tabel yang baru saat modal tertutup.
    const requestDuringReload: Array<PurchaseRequest | null> = [];
    fetchData.mockImplementationOnce(async () => {
      requestDuringReload.push(current().request);
    });
    openWithReason("  Barang sudah tidak dibutuhkan ");

    await act(async () => current().submit());

    expect(mockPatchWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1",
      { action: "CANCEL", alasan: "Barang sudah tidak dibutuhkan" },
    );
    expect(requestDuringReload).toEqual([REQUEST]);
    expect(mockToastSuccess).toHaveBeenCalledWith("Pengajuan dibatalkan.");
    expect(current().request).toBeNull();
    expect(current().isSubmitting).toBe(false);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it.each([404, 409])(
    "menutup modal dan memuat ulang bila pengajuan sudah berubah (%i)",
    async (status) => {
      mockPatchWithAuth.mockResolvedValue(
        respond(status, {
          error: "Pengajuan ini sudah ada barang yang masuk.",
        }),
      );
      openWithReason("Barang sudah tidak dibutuhkan");

      await act(async () => current().submit());

      expect(mockToastError).toHaveBeenCalledWith(
        "Pengajuan ini sudah ada barang yang masuk.",
        expect.anything(),
      );
      expect(current().request).toBeNull();
      expect(current().errorMessage).toBeNull();
      expect(fetchData).toHaveBeenCalledTimes(1);
    },
  );

  it("membiarkan modal terbuka dengan pesannya untuk penolakan lain supaya alasan tidak hilang", async () => {
    mockPatchWithAuth.mockResolvedValue(
      respond(403, { error: "Anda tidak punya izin membatalkan pengajuan." }),
    );
    openWithReason("Barang sudah tidak dibutuhkan");

    await act(async () => current().submit());

    // Pesan tampil di dalam modal (dan difokus di sana), bukan sebagai toast.
    expect(current().errorMessage).toBe(
      "Anda tidak punya izin membatalkan pengajuan.",
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(current().request).toBe(REQUEST);
    expect(current().reason).toBe("Barang sudah tidak dibutuhkan");
    expect(current().isSubmitting).toBe(false);
    expect(fetchData).not.toHaveBeenCalled();
  });

  it("memakai kalimat koneksi bila server tidak bisa dihubungi", async () => {
    mockPatchWithAuth.mockRejectedValue(new TypeError("Failed to fetch"));
    openWithReason("Barang sudah tidak dibutuhkan");

    await act(async () => current().submit());

    expect(current().errorMessage).toBe(RESTOCK_NETWORK_ERROR_MESSAGE);
    expect(current().request).toBe(REQUEST);
  });

  it("menghapus pesan penolakan lama saat mencoba lagi atau membuka pengajuan lain", async () => {
    mockPatchWithAuth.mockResolvedValueOnce(
      respond(500, { error: "Server sedang sibuk." }),
    );
    openWithReason("Barang sudah tidak dibutuhkan");
    await act(async () => current().submit());
    expect(current().errorMessage).toBe("Server sedang sibuk.");

    let resolveRetry: (response: FakeResponse) => void = () => {};
    mockPatchWithAuth.mockReturnValueOnce(
      new Promise<FakeResponse>((resolve) => {
        resolveRetry = resolve;
      }),
    );
    let retry: Promise<void> = Promise.resolve();
    act(() => {
      retry = current().submit();
    });
    expect(current().errorMessage).toBeNull();
    await act(async () => {
      resolveRetry(respond(500, { error: "Server sedang sibuk." }));
      await retry;
    });
    expect(current().errorMessage).toBe("Server sedang sibuk.");

    act(() => current().open({ ...REQUEST, id: "pr-2" }));
    expect(current().errorMessage).toBeNull();
  });

  it("mengabaikan klik kedua selama masih menyimpan", async () => {
    let resolveResponse: (response: FakeResponse) => void = () => {};
    mockPatchWithAuth.mockReturnValue(
      new Promise<FakeResponse>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    openWithReason("Barang sudah tidak dibutuhkan");

    let firstSubmit: Promise<void> = Promise.resolve();
    act(() => {
      firstSubmit = current().submit();
    });
    expect(current().isSubmitting).toBe(true);
    await act(async () => current().submit());
    expect(mockPatchWithAuth).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveResponse(respond(200, { message: "Pengajuan dibatalkan." }));
      await firstSubmit;
    });
    expect(current().isSubmitting).toBe(false);
  });
});
