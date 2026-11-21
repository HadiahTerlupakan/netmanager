// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetWithAuth = vi.fn();
const mockPostWithAuth = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("@/lib/api-client", () => ({
  getWithAuth: (...args: unknown[]) => mockGetWithAuth(...args),
  postWithAuth: (...args: unknown[]) => mockPostWithAuth(...args),
  patchWithAuth: vi.fn(),
  putWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { useRestockPage } from "@/app/admin/inventory/restock/useRestockPage";

type RestockPageState = ReturnType<typeof useRestockPage>;

let container: HTMLDivElement;
let root: Root;
/**
 * Hasil hook terakhir. Ditugaskan di dalam efek, bukan saat render, supaya
 * render tetap murni; `act` menjamin efeknya sudah jalan sebelum tes membaca.
 */
const holder: { state?: RestockPageState } = {};

function current(): RestockPageState {
  if (!holder.state) throw new Error("Hook belum dirender");
  return holder.state;
}

function Harness(): null {
  const state = useRestockPage();
  useEffect(() => {
    holder.state = state;
  });
  return null;
}

/**
 * Hook dirender sungguhan (bukan menebak urutan `useState`), jadi tes ini
 * tetap berlaku walau susunan state di dalam hook berubah.
 */
async function renderPage() {
  await act(async () => {
    root.render(React.createElement(Harness));
  });
}

function fillCompleteForm() {
  act(() => {
    current().setFormGudang("gudang-a");
    current().setFormNotes("Restock ODP");
    current().setFormItems([
      { tipe: "BARANG", barangId: "barang-1", quantity: 1 },
    ]);
  });
}

describe("useRestockPage", () => {
  beforeEach(async () => {
    mockGetWithAuth.mockReset();
    mockPostWithAuth.mockReset();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    mockGetWithAuth.mockResolvedValue({ ok: false, json: async () => ({}) });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await renderPage();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does not submit request again while a submission is already in progress", async () => {
    mockPostWithAuth.mockReturnValue(new Promise(() => {}));
    fillCompleteForm();

    act(() => {
      void current().saveRequest();
    });
    expect(current().submitting).toBe(true);

    await act(async () => current().saveRequest());

    expect(mockPostWithAuth).toHaveBeenCalledTimes(1);
    // Klik kedua saat penyimpanan berjalan diabaikan; dulu ia memunculkan
    // "Harap lengkapi data" padahal datanya sudah lengkap.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("lists every missing part of an incomplete form", async () => {
    await act(async () => current().saveRequest());

    expect(mockPostWithAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      [
        "Pengajuan belum bisa disimpan:",
        "Gudang tujuan belum dipilih.",
        "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
        "Baris ke-1: barangnya belum dipilih.",
      ].join("\n"),
      expect.objectContaining({ duration: 10_000 }),
    );
  });

  it("offers every display status in the filter and filters by it", () => {
    expect(current().statusOptions.map((option) => option.value)).toEqual([
      "all",
      "AWAITING_APPROVAL",
      "APPROVED",
      "RECEIVED",
      "REJECTED",
      "CANCELLED",
    ]);

    act(() => current().setStatusFilter("APPROVED"));

    expect(current().statusFilter).toBe("APPROVED");
  });

  it("exposes the approval, entry, and cancel controllers with nothing open", () => {
    expect(current().approval.request).toBeNull();
    expect(current().entry.request).toBeNull();
    expect(current().cancel.request).toBeNull();
  });
});
