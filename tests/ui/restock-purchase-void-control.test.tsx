// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postWithAuth: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ postWithAuth: mocks.postWithAuth }));
vi.mock("react-hot-toast", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

import { RestockPurchaseVoidControl } from "@/app/admin/inventory/restock/RestockPurchaseVoidControl";

let container: HTMLDivElement;
let root: Root;
let onVoided: ReturnType<typeof vi.fn<() => Promise<void>>>;

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

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return found;
}

function typeReason(value: string) {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("Isian alasan tidak ada");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function renderControl() {
  await act(async () => {
    root.render(
      <RestockPurchaseVoidControl
        requestId="pr-1"
        recordId="rec-1"
        recordLabel="belanja ke-1 di Toko A"
        onVoided={onVoided}
      />,
    );
  });
}

beforeEach(() => {
  mocks.postWithAuth.mockReset();
  mocks.toastSuccess.mockReset();
  onVoided = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("RestockPurchaseVoidControl", () => {
  it("konfirmasi di tempat dengan alasan wajib; tanpa window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    await renderControl();

    await act(async () => button("Batalkan catatan belanja").click());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Batalkan catatan belanja ke-1 di Toko A?",
    );
    expect(document.activeElement).toBe(container.querySelector("textarea"));

    typeReason("abc");
    await act(async () => button("Ya, batalkan catatan").click());

    expect(mocks.postWithAuth).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Tulis alasan pembatalan, minimal 5 huruf.",
    );
  });

  it("mengirim alasan, memberi tahu, lalu memuat ulang data", async () => {
    mocks.postWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { message: "Catatan belanja dibatalkan." }),
    );
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());

    typeReason("  Bukan belanja kita  ");
    await act(async () => button("Ya, batalkan catatan").click());
    await flush();

    expect(mocks.postWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/purchases/rec-1/void",
      { reason: "Bukan belanja kita" },
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Catatan belanja dibatalkan.",
    );
    expect(onVoided).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("409 dari server: pesan server tampil dan data dimuat ulang", async () => {
    mocks.postWithAuth.mockResolvedValueOnce(
      jsonResponse(409, {
        error:
          "Catatan belanja ini sudah dibatalkan sebelumnya. Muat ulang halaman.",
      }),
    );
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());
    typeReason("Salah catat toko");
    await act(async () => button("Ya, batalkan catatan").click());
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Catatan belanja ini sudah dibatalkan sebelumnya. Muat ulang halaman.",
    );
    expect(onVoided).toHaveBeenCalledTimes(1);
  });

  it("Jangan dibatalkan menutup konfirmasi tanpa mengirim", async () => {
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());

    await act(async () => button("Jangan dibatalkan").click());

    expect(container.querySelector("textarea")).toBeNull();
    expect(mocks.postWithAuth).not.toHaveBeenCalled();
  });

  it("menutup dengan Jangan dibatalkan mengembalikan fokus ke tombol pemicu", async () => {
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());

    await act(async () => button("Jangan dibatalkan").click());

    expect(document.activeElement).toBe(button("Batalkan catatan belanja"));
  });

  it("Escape menutup panel saja, tidak sampai ke jendela detail", async () => {
    const documentEscape = vi.fn();
    document.addEventListener("keydown", documentEscape);
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());
    typeReason("Salah catat");

    const textarea = container.querySelector("textarea");
    await act(async () => {
      textarea?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    document.removeEventListener("keydown", documentEscape);

    expect(container.querySelector("textarea")).toBeNull();
    expect(documentEscape).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Batalkan catatan belanja"));
    expect(mocks.postWithAuth).not.toHaveBeenCalled();
  });

  it("setelah berhasil, fokus kembali ke tombol pemicu sebelum data dimuat ulang", async () => {
    mocks.postWithAuth.mockResolvedValueOnce(jsonResponse(200, {}));
    let focusedOnReload: Element | null = null;
    onVoided.mockImplementation(async () => {
      focusedOnReload = document.activeElement;
    });
    await renderControl();
    await act(async () => button("Batalkan catatan belanja").click());
    typeReason("Bukan belanja kita");

    await act(async () => button("Ya, batalkan catatan").click());
    await flush();

    expect(document.activeElement).toBe(button("Batalkan catatan belanja"));
    expect(focusedOnReload).not.toBeNull();
  });
});
