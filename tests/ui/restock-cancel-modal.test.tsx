// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RestockCancelModal } from "@/app/admin/inventory/restock/RestockCancelModal";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";
import type { RestockCancelState } from "@/app/admin/inventory/restock/useRestockCancel";

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

const VALID_REASON = "Barang sudah tidak dibutuhkan";

function makeState(
  overrides: Partial<RestockCancelState> = {},
): RestockCancelState {
  return {
    request: REQUEST,
    reason: "",
    setReason: vi.fn(),
    isSubmitting: false,
    errorMessage: null,
    open: vi.fn(),
    close: vi.fn(),
    submit: vi.fn(async () => {}),
    ...overrides,
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
  document.body
    .querySelectorAll("[data-test-page]")
    .forEach((element) => element.remove());
});

function renderModal(state: RestockCancelState) {
  act(() => root.render(<RestockCancelModal state={state} />));
}

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return button as HTMLButtonElement;
}

function getTextarea(): HTMLTextAreaElement {
  const textarea = document.querySelector("textarea");
  if (!textarea) throw new Error("Kolom alasan tidak ditemukan");
  return textarea;
}

function getDialog(): Element {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) throw new Error("Dialog tidak ditemukan");
  return dialog;
}

/** Tombol halaman (di luar dialog), seperti tombol aksi di tabel pengajuan. */
function addPageButton(label: string, focusKey?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  button.setAttribute("data-test-page", "");
  if (focusKey) button.setAttribute("data-restock-focus", focusKey);
  document.body.appendChild(button);
  return button;
}

describe("RestockCancelModal", () => {
  it("tidak merender apa pun sebelum ada pengajuan yang dipilih", () => {
    renderModal(makeState({ request: null }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("menyebut pengajuan, akibatnya, dan kolom alasan yang wajib", () => {
    renderModal(makeState());

    const dialog = getDialog();
    expect(dialog.textContent).toContain("Batalkan Pengajuan");
    expect(dialog.textContent).toContain("Pengajuan PR-001");
    expect(dialog.textContent).toContain(
      "Setelah dibatalkan, barang dan jasa di pengajuan ini tidak diproses lagi.",
    );
    const textarea = getTextarea();
    const label = document.querySelector(`label[for="${textarea.id}"]`);
    expect(label?.textContent).toBe("Alasan pembatalan (wajib)");
    expect(textarea.maxLength).toBe(255);
    expect(dialog.textContent).toContain(
      "Paling sedikit 5 huruf; spasi di awal dan akhir tidak dihitung. Terisi 0/255.",
    );
  });

  it("memindahkan fokus ke kolom alasan saat terbuka", () => {
    renderModal(makeState());

    expect(document.activeElement).toBe(getTextarea());
  });

  it("menjelaskan kenapa tombol batal mati selama alasan belum cukup", () => {
    renderModal(makeState({ reason: "ok" }));

    const submit = findButton("Ya, Batalkan Pengajuan");
    expect(submit.disabled).toBe(true);
    expect(document.body.textContent).toContain("Belum bisa dibatalkan:");
    expect(document.body.textContent).toContain(
      "Tulis alasan pembatalan, paling sedikit 5 huruf.",
    );
    const textarea = getTextarea();
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    const problemId = submit.getAttribute("aria-describedby");
    expect(problemId).toBeTruthy();
    expect(textarea.getAttribute("aria-describedby")).toContain(problemId);
  });

  it("menghitung alasan tanpa spasi di ujung, sama dengan aturan server", () => {
    renderModal(makeState({ reason: "Stok " }));

    expect(getDialog().textContent).toContain("Terisi 4/255.");
    expect(document.body.textContent).toContain("Belum bisa dibatalkan:");
    expect(findButton("Ya, Batalkan Pengajuan").disabled).toBe(true);
  });

  it("mengaktifkan tombol begitu alasan tanpa spasi di ujung mencapai 5 huruf", () => {
    renderModal(makeState({ reason: "  Rusak  " }));

    expect(getDialog().textContent).toContain("Terisi 5/255.");
    expect(findButton("Ya, Batalkan Pengajuan").disabled).toBe(false);
  });

  it("tidak menandai kolom kosong sebagai salah sebelum diisi", () => {
    renderModal(makeState({ reason: "" }));

    expect(getTextarea().getAttribute("aria-invalid")).toBe("false");
  });

  it("mengirim pembatalan setelah alasan cukup", () => {
    const state = makeState({ reason: VALID_REASON });
    renderModal(state);

    const submit = findButton("Ya, Batalkan Pengajuan");
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute("aria-disabled")).toBe("false");
    expect(document.body.textContent).not.toContain("Belum bisa dibatalkan:");

    act(() => submit.click());
    expect(state.submit).toHaveBeenCalledTimes(1);
  });

  it("meneruskan ketikan alasan ke state", () => {
    const state = makeState();
    renderModal(state);
    const textarea = getTextarea();
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;

    act(() => {
      setValue?.call(textarea, "Sudah tidak dipakai");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(state.setReason).toHaveBeenCalledWith("Sudah tidak dipakai");
  });

  it("menutup lewat Kembali dan Escape", () => {
    const state = makeState();
    renderModal(state);

    act(() => findButton("Kembali").click());
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it("tidak bisa ditutup atau dikirim ulang selama sedang membatalkan", () => {
    const state = makeState({ reason: VALID_REASON, isSubmitting: true });
    renderModal(state);

    const submit = findButton("Membatalkan...");
    // aria-disabled, bukan disabled: tombol tetap bisa memegang fokus.
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(findButton("Kembali").disabled).toBe(true);
    act(() => submit.click());
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(state.submit).not.toHaveBeenCalled();
    expect(state.close).not.toHaveBeenCalled();
  });

  it("menjaga fokus di dalam dialog sejak dikirim sampai selesai menyimpan", () => {
    const state = makeState({ reason: VALID_REASON });
    renderModal(state);
    // Safari tidak memfokuskan tombol yang diklik: fokus masih di kolom
    // alasan, yang lalu terkunci selama menyimpan.
    getTextarea().focus();

    act(() => findButton("Ya, Batalkan Pengajuan").click());
    const submit = findButton("Ya, Batalkan Pengajuan");
    expect(document.activeElement).toBe(submit);

    renderModal({ ...state, isSubmitting: true });
    expect(document.activeElement).toBe(submit);
    expect(getDialog().contains(document.activeElement)).toBe(true);

    renderModal({ ...state, isSubmitting: false });
    expect(document.activeElement).toBe(submit);
  });

  it("memindahkan fokus ke pesan penolakan di dalam dialog bila gagal", () => {
    const state = makeState({ reason: VALID_REASON });
    renderModal(state);
    act(() => findButton("Ya, Batalkan Pengajuan").click());
    renderModal({ ...state, isSubmitting: true });

    renderModal({
      ...state,
      errorMessage: "Anda tidak punya izin membatalkan pengajuan.",
    });

    const focused = document.activeElement as HTMLElement;
    expect(focused.textContent).toBe(
      "Anda tidak punya izin membatalkan pengajuan.",
    );
    expect(focused.tabIndex).toBe(-1);
    expect(getDialog().contains(focused)).toBe(true);
    expect(
      findButton("Ya, Batalkan Pengajuan").getAttribute("aria-describedby"),
    ).toBe(focused.id);
  });

  it("mengembalikan fokus ke tombol pembuka setelah modal tertutup", () => {
    const trigger = addPageButton("Batalkan PR-001");
    trigger.focus();

    renderModal(makeState());
    expect(document.activeElement).toBe(getTextarea());

    renderModal(makeState({ request: null }));
    expect(document.activeElement).toBe(trigger);
  });

  it("memfokuskan tombol Detail pengajuan bila tombol Batalkan hilang sesudah dibatalkan", () => {
    const trigger = addPageButton("Batalkan PR-001", "cancel:pr-1");
    trigger.focus();
    renderModal(makeState({ reason: VALID_REASON }));

    // Daftar dimuat ulang sebelum modal ditutup: tabel dirender ulang dan
    // pengajuan yang dibatalkan tidak lagi punya tombol Batalkan.
    trigger.remove();
    addPageButton("Detail PR-002", "detail:pr-2");
    const detail = addPageButton("Detail PR-001", "detail:pr-1");
    renderModal(makeState({ request: null }));

    expect(document.activeElement).toBe(detail);
  });

  it("memfokuskan tombol Batalkan yang baru bila pengajuannya masih bisa dibatalkan", () => {
    const trigger = addPageButton("Batalkan PR-001", "cancel:pr-1");
    trigger.focus();
    renderModal(makeState({ reason: VALID_REASON }));

    trigger.remove();
    addPageButton("Detail PR-001", "detail:pr-1");
    const freshCancel = addPageButton("Batalkan PR-001", "cancel:pr-1");
    renderModal(makeState({ request: null }));

    expect(document.activeElement).toBe(freshCancel);
  });

  it("melewati tombol pengganti yang tidak bisa difokus", () => {
    renderModal(makeState());
    const hidden = addPageButton("Detail PR-001 (versi kartu)", "detail:pr-1");
    hidden.disabled = true;
    const visible = addPageButton("Detail PR-001", "detail:pr-1");

    renderModal(makeState({ request: null }));

    expect(document.activeElement).toBe(visible);
  });
});
