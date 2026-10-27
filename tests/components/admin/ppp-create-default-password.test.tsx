// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi: form tambah pelanggan mengisi password PPPoE dan portal dengan
 * "123456" untuk semua pelanggan. Admin yang tidak menggantinya meninggalkan
 * akun yang bisa ditebak siapa saja; di produksi tes-lab-03 baru terlihat
 * memakai nilai itu sebelum diganti manual.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/pelanggan/ppp/create",
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: undefined as unknown,
    error: undefined as Error | undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

let container: HTMLElement;
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

describe("form tambah pelanggan PPP", () => {
  it("mengisi password PPPoE dan portal secara acak, bukan 123456", async () => {
    const { PppClientCreateForm } =
      await import("@/app/admin/pelanggan/ppp/create/PppNewClient");
    await act(async () => root.render(<PppClientCreateForm />));
    const infoTab = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Info Pelanggan",
    );
    await act(async () => infoTab?.click());

    const ppp = container.querySelector<HTMLInputElement>(
      "input[name=password]",
    );
    const portal = container.querySelector<HTMLInputElement>(
      "input[name=passwordLogin]",
    );
    expect(ppp?.value).toHaveLength(12);
    expect(portal?.value).toHaveLength(12);
    expect(ppp?.value).not.toBe("123456");
    expect(ppp?.value).not.toBe(portal?.value);
  });
});
