// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/inventory/PhotoUpload", () => ({
  PhotoUpload: () => <div>Photo upload</div>,
}));

import { RestockReceiveModal } from "@/app/admin/inventory/restock/RestockReceiveModal";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";
import type { RestockEntryState } from "@/app/admin/inventory/restock/useRestockEntry";
import { makeRestockEntryState } from "@/tests/fixtures/restock-entry-state";

function makeRequest(receivedQuantity = 0): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-1",
    gudang: { id: "gudang-1", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [
      {
        id: "item-1",
        barangId: "barang-1",
        jumlah: 10,
        receivedQuantity,
        barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
      },
    ],
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return button as HTMLButtonElement;
}

function findAlertDialog(): Element | null {
  return document.querySelector('[role="alertdialog"]');
}

function renderModal(
  overrides: Partial<RestockEntryState> = {},
): RestockEntryState {
  const entry = makeRestockEntryState({
    request: makeRequest(),
    receivedItems: { "barang-1": 6 },
    photos: [{ preview: "x" } as never],
    ...overrides,
  });
  act(() => {
    root.render(
      <RestockReceiveModal entry={entry} barangs={[]} canOverReceive={false} />,
    );
  });
  return entry;
}

/** Ketik angka seperti petugas: React membaca event `input`. */
function typeQuantity(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("konfirmasi barang kurang di modal Lapor Barang Sampai", () => {
  it("langsung menyimpan tanpa konfirmasi bila semua sisa dimasukkan", () => {
    const entry = renderModal({ receivedItems: { "barang-1": 10 } });

    act(() => findButton("Simpan Laporan").click());

    expect(findAlertDialog()).toBeNull();
    expect(entry.submit).toHaveBeenCalledTimes(1);
  });

  it("meminta konfirmasi dulu bila ada barang yang masuk kurang dari sisanya", () => {
    const entry = renderModal();

    act(() => findButton("Simpan Laporan").click());

    expect(findAlertDialog()).not.toBeNull();
    expect(entry.submit).not.toHaveBeenCalled();

    act(() => findButton("Ya, selesaikan").click());

    expect(entry.submit).toHaveBeenCalledTimes(1);
    expect(findAlertDialog()).toBeNull();
  });

  it("mengembalikan fokus ke tombol simpan setelah Kembali", () => {
    const entry = renderModal();
    act(() => findButton("Simpan Laporan").click());

    act(() => findButton("Kembali").click());

    expect(findAlertDialog()).toBeNull();
    expect(document.activeElement).toBe(findButton("Simpan Laporan"));
    expect(entry.submit).not.toHaveBeenCalled();
  });

  it("menganggap Escape sebagai Kembali, bukan menutup modal", () => {
    const entry = renderModal();
    act(() => findButton("Simpan Laporan").click());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(entry.close).not.toHaveBeenCalled();
    expect(findAlertDialog()).toBeNull();
  });

  it("meminta konfirmasi bila isian sesuai yang disetujui tetapi pesanannya sudah dinaikkan", () => {
    const raised = makeRequest();
    raised.items[0] = { ...raised.items[0], orderedQuantity: 15 };
    const entry = renderModal({
      request: raised,
      receivedItems: { "barang-1": 10 },
    });

    act(() => findButton("Simpan Laporan").click());

    expect(
      document.getElementById(
        findAlertDialog()?.getAttribute("aria-labelledby") ?? "",
      )?.textContent,
    ).toBe("Kabel Fiber 5 roll tidak sampai dan pengajuan selesai. Lanjutkan?");
    expect(entry.submit).not.toHaveBeenCalled();
  });

  it("memberi nama yang bisa dibaca pada dialog konfirmasi", () => {
    renderModal();
    act(() => findButton("Simpan Laporan").click());

    const labelId = findAlertDialog()?.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe(
      "Kabel Fiber 4 roll tidak sampai dan pengajuan selesai. Lanjutkan?",
    );
  });

  it("menutup konfirmasi tanpa merebut fokus saat jumlah diubah", () => {
    const entry = renderModal();
    act(() => findButton("Simpan Laporan").click());
    const input = document.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    if (!input) throw new Error("Kolom jumlah tidak ditemukan");

    act(() => {
      input.focus();
      typeQuantity(input, "8");
    });

    expect(findAlertDialog()).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(entry.setReceivedItems).toHaveBeenCalledWith({ "barang-1": 8 });
  });

  it("membatasi angka yang diketik pada sisa bagi petugas tanpa izin kelebihan", () => {
    const entry = renderModal({ receivedItems: { "barang-1": 10 } });
    const input = document.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    if (!input) throw new Error("Kolom jumlah tidak ditemukan");

    act(() => typeQuantity(input, "15"));

    expect(entry.setReceivedItems).toHaveBeenLastCalledWith({ "barang-1": 10 });
  });

  it("data lama: menyelesaikan tanpa barang tambahan lewat konfirmasi, tanpa foto", () => {
    const entry = renderModal({
      request: makeRequest(4),
      receivedItems: { "barang-1": 0 },
      photos: [],
    });

    act(() => findButton("Selesaikan tanpa barang tambahan").click());
    expect(
      document.getElementById(
        findAlertDialog()?.getAttribute("aria-labelledby") ?? "",
      )?.textContent,
    ).toBe("Kabel Fiber 6 roll tidak sampai dan pengajuan selesai. Lanjutkan?");

    act(() => findButton("Ya, selesaikan").click());
    expect(entry.submit).toHaveBeenCalledTimes(1);
  });
});
