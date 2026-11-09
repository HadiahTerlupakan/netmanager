// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getWithAuth: mocks.getWithAuth,
  postWithAuth: mocks.postWithAuth,
  deleteWithAuth: mocks.deleteWithAuth,
}));

vi.mock("react-hot-toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { RestockPurchaseLinkPanel } from "@/app/admin/inventory/restock/RestockPurchaseLinkPanel";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

const REQUEST = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  gudang: { id: "g-1", nama: "Gudang Utama" },
} as PurchaseRequest;

const LINK = {
  id: "link-1",
  createdAt: "2026-11-09T03:00:00.000Z",
  expiresAt: "2026-12-09T03:00:00.000Z",
  lastUsedAt: null as string | null,
  createdByName: "Budi",
};
const LINK_URL = "https://situs.test/belanja#abcDEF_-123";
const INTRO_TEXT =
  "Barang sudah dibeli atau belum hanya dicatat lewat link ini.";

let container: HTMLDivElement;
let root: Root;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

async function renderPanel(
  request: PurchaseRequest = REQUEST,
  isFocusedOnOpen = false,
) {
  await act(async () => {
    root.render(
      <RestockPurchaseLinkPanel
        request={request}
        isFocusedOnOpen={isFocusedOnOpen}
      />,
    );
  });
  await flush();
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return found as HTMLButtonElement;
}

async function click(text: string) {
  await act(async () => button(text).click());
  await flush();
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("RestockPurchaseLinkPanel", () => {
  it.each(["CLOSED", "NOT_APPROVED", "MERGED_ORDER"])(
    "tidak tampil bila availability %s tanpa link aktif",
    async (availability) => {
      mocks.getWithAuth.mockResolvedValue(
        jsonResponse(200, { data: { link: null, availability } }),
      );
      await renderPanel();
      expect(container.textContent).toBe("");
    },
  );

  it.each(["ALL_PURCHASED", "STORAGE_OFF", "MERGED_ORDER", "CLOSED"])(
    "link aktif tetap tampil dengan tombol Matikan saat %s, tanpa Buat link baru",
    async (availability) => {
      mocks.getWithAuth.mockResolvedValue(
        jsonResponse(200, { data: { link: LINK, availability } }),
      );
      mocks.deleteWithAuth.mockResolvedValueOnce(
        jsonResponse(200, { data: { revoked: true } }),
      );
      await renderPanel();

      expect(container.textContent).toContain("Link dibuat");
      expect(container.textContent).toContain("Link ini masih berlaku");
      expect(() => button("Buat link baru")).toThrow();
      // Kalimat "hanya dicatat lewat link ini" tidak bertentangan dengan
      // alasan link tidak bisa dipakai.
      expect(container.textContent).not.toContain(INTRO_TEXT);

      await click("Matikan link");
      await click("Ya, matikan");

      expect(mocks.deleteWithAuth).toHaveBeenCalledWith(
        "/api/inventory/restock/requests/pr-1/purchase-link",
      );
    },
  );

  it("pengajuan yang sudah selesai: panel muncul hanya bila masih ada link aktif", async () => {
    const finished = { ...REQUEST, status: "RECEIVED" } as PurchaseRequest;
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: null, availability: "CLOSED" } }),
    );
    await renderPanel(finished);
    expect(container.textContent).toBe("");

    act(() => root.unmount());
    root = createRoot(container);
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: LINK, availability: "CLOSED" } }),
    );
    await renderPanel(finished);
    expect(container.textContent).toContain("Matikan link");
  });

  it("pesanan gabungan dengan link sisa: penjelasan awam tanpa kalimat pembuka", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { link: LINK, availability: "MERGED_ORDER" },
      }),
    );
    await renderPanel();
    expect(container.textContent).toContain(
      "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi link belanja tidak bisa dipakai dan belanjanya tidak dicatat. Statusnya mengikuti barang yang datang.",
    );
    expect(container.textContent).not.toContain(INTRO_TEXT);
  });

  it("penyimpanan belum aktif: menyebut barang datang tetap bisa dicatat", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: null, availability: "STORAGE_OFF" } }),
    );
    await renderPanel();
    expect(container.textContent).toContain(
      "Barang yang datang tetap bisa dicatat lewat tombol Catat Barang Datang.",
    );
    expect(container.textContent).not.toContain(INTRO_TEXT);
    expect(container.querySelector("button")).toBeNull();
  });

  it("data lama yang sudah ditandai dibeli sekaligus tidak ditawari link baru", async () => {
    const legacy = {
      ...REQUEST,
      items: [
        {
          id: "ri-1",
          barangId: "b-1",
          jumlah: 10,
          orderedQuantity: 10,
          purchasedQuantity: 0,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          purchaseOrderItemId: "poi-1",
          statusApproval: "APPROVED",
        },
      ],
      purchaseRecords: [],
      goodsReceipts: [],
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "ORDERED",
        issuedAt: "2026-10-01T03:00:00.000Z",
      },
    } as unknown as PurchaseRequest;
    // Server kini mengenal data lama dan menjawab ALL_PURCHASED.
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { link: null, availability: "ALL_PURCHASED" },
      }),
    );
    await renderPanel(legacy);

    expect(container.textContent).toContain(
      "Semua barang sudah dibeli, jadi link belanja tidak diperlukan lagi.",
    );
    expect(container.textContent).not.toContain(INTRO_TEXT);
    expect(container.querySelector("button")).toBeNull();
  });

  it("menjelaskan bila semua sudah dibeli atau penyimpanan belum aktif", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { link: null, availability: "ALL_PURCHASED" },
      }),
    );
    await renderPanel();
    expect(container.textContent).toContain(
      "Semua barang sudah dibeli, jadi link belanja tidak diperlukan lagi.",
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("membuat link, menampilkannya sekali, menyalin, dan menyiapkan WhatsApp", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: null, availability: "AVAILABLE" } }),
    );
    mocks.postWithAuth.mockResolvedValueOnce(
      jsonResponse(201, { data: { link: LINK, url: LINK_URL } }),
    );
    await renderPanel();

    await click("Buat link belanja");

    expect(mocks.postWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/purchase-link",
      {},
    );
    const input = container.querySelector<HTMLInputElement>("input[readonly]");
    expect(input?.value).toBe(LINK_URL);
    expect(container.textContent).toContain(
      "Link ini hanya ditampilkan sekali. Salin atau kirim sekarang.",
    );
    const whatsapp = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent?.includes("Kirim lewat WhatsApp"),
    );
    expect(whatsapp?.getAttribute("href")).toContain("https://wa.me/?text=");
    expect(whatsapp?.getAttribute("href")).toContain("%23abcDEF_-123");
    expect(whatsapp?.getAttribute("rel")).toBe("noopener noreferrer");

    await click("Salin link");
    expect(writeText).toHaveBeenCalledWith(LINK_URL);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link disalin");
  });

  it("tidak menampilkan link lama, hanya info dan aksi dengan konfirmasi", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: LINK, availability: "AVAILABLE" } }),
    );
    mocks.deleteWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { revoked: true } }),
    );
    await renderPanel();

    expect(container.textContent).toContain("Link belanja aktif");
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toMatch(
      /Link dibuat 9 Nov 2026 oleh Budi, berlaku sampai 9 Des 2026\. Terakhir dibuka: belum pernah\./,
    );
    expect(container.textContent).toContain(
      "Demi keamanan, link tidak bisa ditampilkan lagi.",
    );

    await click("Matikan link");
    expect(container.textContent).toContain(
      "Link ini akan langsung tidak bisa dipakai. Lanjut?",
    );
    expect(document.activeElement).toBe(button("Batal"));
    expect(mocks.deleteWithAuth).not.toHaveBeenCalled();

    await click("Ya, matikan");
    expect(mocks.deleteWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/purchase-link",
    );
    expect(button("Buat link belanja")).toBeTruthy();
  });

  it("meminta konfirmasi sebelum mengganti link dan bisa dibatalkan", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: LINK, availability: "AVAILABLE" } }),
    );
    await renderPanel();

    await click("Buat link baru");
    expect(container.textContent).toContain(
      "Link lama akan langsung tidak bisa dipakai. Lanjut?",
    );
    await click("Batal");
    expect(mocks.postWithAuth).not.toHaveBeenCalled();
    expect(button("Buat link baru")).toBeTruthy();
  });

  it("menampilkan galat server saat pembuatan ditolak", async () => {
    mocks.getWithAuth
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { link: null, availability: "AVAILABLE" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { link: null, availability: "STORAGE_OFF" },
        }),
      );
    mocks.postWithAuth.mockResolvedValueOnce(
      jsonResponse(409, { error: "Penyimpanan tanda tangan belum aktif." }),
    );
    await renderPanel();

    await click("Buat link belanja");

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Penyimpanan tanda tangan belum aktif.",
    );
    expect(container.textContent).toContain(
      "Link belanja belum bisa dibuat karena penyimpanan tanda tangan belum aktif.",
    );
  });

  it("dibuka dari tabel: fokus ke judul panel setelah status dimuat", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: null, availability: "AVAILABLE" } }),
    );
    await renderPanel(REQUEST, true);

    const heading = container.querySelector("h3");
    expect(heading?.textContent).toContain("Link belanja");
    expect(document.activeElement).toBe(heading);
    expect(button("Buat link belanja")).toBeTruthy();
    expect(container.textContent).toContain(INTRO_TEXT);
  });

  it("dibuka biasa: fokus tidak dipindahkan", async () => {
    mocks.getWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { data: { link: null, availability: "AVAILABLE" } }),
    );
    await renderPanel();

    expect(document.activeElement).not.toBe(container.querySelector("h3"));
  });
});
