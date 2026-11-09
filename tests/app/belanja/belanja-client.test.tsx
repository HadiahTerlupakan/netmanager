// @vitest-environment jsdom

import React, { act, forwardRef, useImperativeHandle, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

vi.mock("@/components/signature/SignaturePad", () => ({
  default: forwardRef<
    { toDataUrl: () => string | null; clear: () => void },
    { onChange?: (hasStroke: boolean) => void }
  >(function FakeSignaturePad({ onChange }, ref) {
    const [isSigned, setIsSigned] = useState(false);
    useImperativeHandle(ref, () => ({
      toDataUrl: () => (isSigned ? PNG_DATA_URL : null),
      clear: () => {
        setIsSigned(false);
        onChange?.(false);
      },
    }));
    return (
      <button
        type="button"
        onClick={() => {
          setIsSigned(true);
          onChange?.(true);
        }}
      >
        Tanda tangani
      </button>
    );
  }),
}));

import BelanjaClient from "@/app/belanja/BelanjaClient";

const TOKEN = "B".repeat(43);

const LIST = {
  state: "ACTIVE",
  requestNumber: "PR-001",
  warehouseName: "Gudang Utama",
  validUntil: "2026-12-09T00:00:00.000Z",
  items: [
    {
      purchaseOrderItemId: "poi-1",
      name: "Kabel Fiber",
      unit: "roll",
      needed: 10,
      purchased: 4,
      remaining: 6,
      stores: [
        { storeName: "Toko Lama", purchasedAt: "2026-11-08", quantity: 4 },
      ],
    },
    {
      purchaseOrderItemId: "poi-2",
      name: "ONT",
      unit: "pcs",
      needed: 2,
      purchased: 2,
      remaining: 0,
      stores: [],
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bodyOf(callIndex: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

async function renderPage(hash: string) {
  window.history.replaceState(null, "", `/belanja${hash}`);
  await act(async () => {
    root.render(<BelanjaClient />);
  });
  await flush();
}

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(input) as object;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Isian lewat teks label-nya, atau lewat `aria-labelledby` (centang barang). */
function fieldByLabel(text: string): HTMLInputElement {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) => candidate.textContent === text,
  );
  const labelledBy = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[aria-labelledby]"),
  ).find(
    (candidate) =>
      document.getElementById(candidate.getAttribute("aria-labelledby") ?? "")
        ?.textContent === text,
  );
  const input = label
    ? document.getElementById(label.htmlFor)
    : (labelledBy ?? null);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Isian "${text}" tidak ditemukan`);
  }
  return input;
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  if (!found) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return found as HTMLButtonElement;
}

async function fillAndSubmit() {
  act(() => fieldByLabel("Kabel Fiber").click());
  act(() => setInputValue(fieldByLabel("Nama toko"), "Toko Sinar Jaya"));
  act(() => setInputValue(fieldByLabel("Nama Anda (yang belanja)"), "Andi"));
  act(() => button("Tanda tangani").click());
  await act(async () => button("Simpan belanja").click());
  await flush();
}

beforeEach(() => {
  // jsdom tidak punya scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BelanjaClient", () => {
  it("langsung menyatakan link tidak berlaku tanpa request bila fragmen kosong", async () => {
    await renderPage("");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Link ini sudah tidak berlaku");
  });

  it("menghapus token dari alamat & riwayat begitu dibaca, lalu memakainya dari sessionStorage", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.pathname).toBe("/belanja");
    expect(window.sessionStorage.getItem("belanja:token")).toBe(TOKEN);
    expect(bodyOf(0)).toEqual({ token: TOKEN });

    // Muat ulang: fragmen sudah tidak ada, token dibaca dari sessionStorage.
    act(() => root.unmount());
    root = createRoot(container);
    await renderPage("");
    expect(bodyOf(1)).toEqual({ token: TOKEN });
    expect(document.body.textContent).not.toContain(
      "Link ini sudah tidak berlaku",
    );
  });

  it("link baru di tab yang sama (hashchange) menggantikan token lama", async () => {
    const otherToken = "C".repeat(43);
    fetchMock.mockResolvedValue(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await act(async () => {
      window.history.replaceState(null, "", `/belanja#${otherToken}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await flush();

    expect(bodyOf(fetchMock.mock.calls.length - 1)).toEqual({
      token: otherToken,
    });
    expect(window.sessionStorage.getItem("belanja:token")).toBe(otherToken);
    expect(window.location.hash).toBe("");
  });

  it("fragmen salah bentuk tetap tidak berlaku walau ada token lama di sesi", async () => {
    window.sessionStorage.setItem("belanja:token", TOKEN);
    await renderPage("#bukan-token");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Link ini sudah tidak berlaku");
  });

  it("tetap jalan bila sessionStorage diblokir", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("diblokir");
    });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    expect(window.location.hash).toBe("");
    expect(bodyOf(0)).toEqual({ token: TOKEN });
    expect(document.body.textContent).toContain("Kabel Fiber");
  });

  it("mengirim token hanya di body, tanpa cookie dan referrer", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/belanja/daftar");
    expect(url).not.toContain(TOKEN);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    expect(bodyOf(0)).toEqual({ token: TOKEN });
  });

  it("menampilkan daftar barang, sisa, rincian toko, dan barang yang sudah dibeli semua", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    const text = document.body.textContent ?? "";
    expect(text).toContain("Pengajuan PR-001 · untuk Gudang Utama");
    expect(text).toContain("Butuh 10 roll · Sudah dibeli 4 · Sisa 6");
    expect(text).toMatch(/Dibeli di Toko Lama, 08 Nov 2026: 4 roll/);
    expect(text).toContain("Sudah dibeli semua");
    expect(fieldByLabel("ONT").disabled).toBe(true);
    for (const word of [/\bPO\b/, /supplier/i, /vendor/i, /token/i]) {
      expect(text).not.toMatch(word);
    }
  });

  it("menampilkan masalah isian dengan pesan persis tanpa mengirim", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await act(async () => button("Simpan belanja").click());

    const alert = document.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("Centang dulu barang yang Anda beli.");
    expect(alert).toContain("Isi nama toko.");
    expect(alert).toContain("Isi nama Anda.");
    expect(alert).toContain("Tanda tangan dulu di kotak tanda tangan.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("simpan gagal karena isian kurang: kotak masalah digulir ke layar dan difokuskan", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await act(async () => button("Simpan belanja").click());

    const alert = document.querySelector('[role="alert"]');
    const region = alert?.parentElement;
    expect(region).toBeTruthy();
    expect(document.activeElement).toBe(region);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
    });
  });

  it("seluruh kepala kartu barang bisa diketuk untuk mencentang", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    const summary = Array.from(document.querySelectorAll("span")).find(
      (span) => span.textContent === "Butuh 10 roll · Sudah dibeli 4 · Sisa 6",
    );
    act(() => summary?.click());

    expect(fieldByLabel("Kabel Fiber").checked).toBe(true);
  });

  it("pesan tersimpan difokuskan lagi pada belanja kedua dan hilang saat isian baru disentuh", async () => {
    const saved = () =>
      jsonResponse(201, {
        data: { state: "ACTIVE", message: "Masih ada.", isReplay: false },
      });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(saved())
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(saved())
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);
    const banner = () => document.querySelector('[role="status"]');

    await fillAndSubmit();
    expect(banner()?.textContent).toContain("Tersimpan. Terima kasih, Andi.");

    act(() => setInputValue(fieldByLabel("Nama toko"), "Toko Kedua"));
    expect(banner()).toBeNull();

    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await fillAndSubmit();
    expect(document.activeElement).toBe(banner());
  });

  it("bentrok (409) mengganti clientRequestId untuk simpan berikutnya", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          success: false,
          error: "Belanja yang Anda kirim sebelumnya sudah tersimpan.",
          code: "CONFLICT",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: { state: "ACTIVE", message: "", isReplay: false },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();
    expect(document.body.textContent).toContain(
      "Belanja yang Anda kirim sebelumnya sudah tersimpan.",
    );
    await act(async () => button("Simpan belanja").click());
    await flush();

    expect(bodyOf(3).clientRequestId).not.toBe(bodyOf(1).clientRequestId);
  });

  it("memakai ulang clientRequestId saat gagal dan menggantinya setelah tersimpan", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(500, { success: false, error: "Ada gangguan." }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: { state: "ACTIVE", message: "Masih ada.", isReplay: false },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: { state: "ACTIVE", message: "Masih ada.", isReplay: false },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();
    expect(document.body.textContent).toContain("Ada gangguan.");
    await act(async () => button("Simpan belanja").click());
    await flush();

    const firstId = bodyOf(1).clientRequestId;
    expect(bodyOf(2).clientRequestId).toBe(firstId);
    expect(bodyOf(2)).toMatchObject({
      token: TOKEN,
      buyerName: "Andi",
      storeName: "Toko Sinar Jaya",
      signatureDataUrl: PNG_DATA_URL,
      items: [{ purchaseOrderItemId: "poi-1", quantity: 6, unitPrice: null }],
    });
    expect(document.body.textContent).toContain(
      "Tersimpan. Terima kasih, Andi. Masih ada.",
    );
    // Isian dikosongkan, nama dipertahankan dan diingat.
    expect(fieldByLabel("Nama toko").value).toBe("");
    expect(fieldByLabel("Nama Anda (yang belanja)").value).toBe("Andi");
    expect(window.localStorage.getItem("belanja:namaPembeli")).toBe("Andi");

    await fillAndSubmit();
    expect(bodyOf(4).clientRequestId).not.toBe(firstId);
  });

  it("menampilkan tidak berlaku bila link mati saat menyimpan", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(404, {
          success: false,
          error: "Link ini sudah tidak berlaku.",
          code: "LINK_INACTIVE",
        }),
      );
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();

    expect(document.body.textContent).toContain("Link ini sudah tidak berlaku");
    expect(document.querySelector("form")).toBeNull();
  });

  it("memuat ulang daftar setelah bentrok dan menampilkan pesannya", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          success: false,
          error: "Daftar belanja baru saja berubah.",
          code: "CONFLICT",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/belanja/daftar");
    expect(document.body.textContent).toContain(
      "Daftar belanja baru saja berubah.",
    );
    expect(fieldByLabel("Nama toko").value).toBe("Toko Sinar Jaya");
  });

  it("menampilkan pesan batas percobaan dan pesan tanpa internet", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(429, {
          success: false,
          error: "Terlalu sering dicoba. Tunggu sebentar, lalu coba lagi.",
          code: "RATE_LIMITED",
        }),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();
    expect(document.body.textContent).toContain("Terlalu sering dicoba.");

    await act(async () => button("Simpan belanja").click());
    await flush();
    expect(document.body.textContent).toContain(
      "Tidak tersambung ke internet. Isian Anda masih ada, coba kirim lagi.",
    );
  });

  it("menampilkan semua sudah dibeli tanpa isian", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: { ...LIST, state: "ALL_PURCHASED" } }),
    );
    await renderPage(`#${TOKEN}`);

    expect(document.body.textContent).toContain("Semua barang sudah dibeli");
    expect(document.querySelector("form")).toBeNull();
  });

  it("tetap jalan bila localStorage diblokir", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: {
            state: "ALL_PURCHASED",
            message: "Semua barang sudah dibeli. Terima kasih.",
            isReplay: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { ...LIST, state: "ALL_PURCHASED" } }),
      );
    await renderPage(`#${TOKEN}`);

    expect(fieldByLabel("Nama Anda (yang belanja)").value).toBe("");
    await fillAndSubmit();

    expect(document.body.textContent).toContain(
      "Tersimpan. Terima kasih, Andi.",
    );
    expect(document.body.textContent).toContain("Semua barang sudah dibeli");
  });

  it("belanja terakhir: langsung 'semua sudah dibeli' tanpa memuat ulang link yang sudah dimatikan", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          data: {
            state: "ALL_PURCHASED",
            message: "Semua barang sudah dibeli. Terima kasih.",
            isReplay: false,
          },
        }),
      );
    await renderPage(`#${TOKEN}`);

    await fillAndSubmit();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Semua barang sudah dibeli");
    expect(document.body.textContent).not.toContain(
      "Link ini sudah tidak berlaku",
    );
  });

  it("menampilkan galat muat dengan tombol coba lagi", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { data: LIST }));
    await renderPage(`#${TOKEN}`);

    expect(document.body.textContent).toContain(
      "Daftar belanja belum bisa dibuka",
    );
    await act(async () => button("Coba lagi").click());
    await flush();
    expect(document.body.textContent).toContain("Kabel Fiber");
  });
});
