// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiData = vi.hoisted(() => new Map<string, unknown>());
const apiErrors = vi.hoisted(() => new Map<string, Error>());
const permissions = vi.hoisted(() => new Set<string>());

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (key: string) => ({
    data: apiData.get(key),
    error: apiErrors.get(key) ?? null,
    isLoading: false,
    mutate: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: (permission: string) => permissions.has(permission),
  }),
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => <button disabled={disabled}>{children}</button>,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { ClientComponent } from "@/app/admin/pengaturan/halaman-isolir/HalamanIsolirClient";

const payment = { label: "BCA", number: "123", holder: "PT Net" };

function setView(
  page: Record<string, unknown> | null,
  dropped: string[] = [],
): void {
  apiData.set("/api/admin/isolir-page", {
    page,
    preview: { html: "<h1>Halaman</h1>", hash: "h1", dropped },
  });
}

describe("Pengaturan Halaman Isolir", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    apiData.clear();
    apiErrors.clear();
    permissions.clear();
    permissions.add("isolir_page:update");
    apiData.set("/api/admin/isolir-page/status", []);
  });

  it("mengisi form dari konfigurasi tersimpan dan menampilkan pratinjau", () => {
    setView({ ispName: "Net Contoh", logoUrl: null, payments: [payment] });

    const html = renderToStaticMarkup(<ClientComponent />);

    expect(html).toContain('value="Net Contoh"');
    expect(html).toContain('value="BCA"');
    expect(html).toContain("srcDoc=");
    expect(html).toContain("Simpan");
    expect(html).not.toContain("Hapus logo");
  });

  it("memperingatkan logo yang tidak muat dan menampilkan status router", () => {
    setView({ logoUrl: "/uploads/logos/x.webp", payments: [] }, ["logo"]);
    apiData.set("/api/admin/isolir-page/status", [
      {
        id: "r1",
        name: "Router A",
        synced: false,
        isolirPageSyncedAt: null,
        isolirPageError: "timeout",
      },
    ]);

    const html = renderToStaticMarkup(<ClientComponent />);

    expect(html).toContain("Logo tidak dimuat karena halaman melebihi 24 KiB");
    expect(html).toContain("Hapus logo");
    expect(html).toContain("Router A");
    expect(html).toContain("Belum terkini");
    expect(html).toContain("timeout");
    expect(html).toContain(
      "Router yang gagal akan diperbarui saat Reconfigurasi Mikrotik",
    );
  });

  it("menonaktifkan tambah rekening setelah 10 rekening", () => {
    setView({ logoUrl: null, payments: Array(10).fill(payment) });

    const html = renderToStaticMarkup(<ClientComponent />);

    expect(html).toMatch(
      /<button disabled="">[^<]*<svg[^>]*>.*?<\/svg>Tambah rekening/,
    );
  });

  it("tanpa izin ubah, form terkunci dan tombol Simpan tidak ada", () => {
    permissions.clear();
    setView(null);

    const html = renderToStaticMarkup(<ClientComponent />);

    expect(html).toContain("<fieldset disabled=");
    expect(html).not.toContain("Simpan");
  });

  it("GET gagal: form dan Simpan terkunci, submit tidak mengirim PUT", async () => {
    apiErrors.set("/api/admin/isolir-page", new Error("Gagal memuat"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => root.render(<ClientComponent />));
    expect(container.textContent).toContain("Gagal memuat");
    expect(container.textContent).toContain("Coba lagi");
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    const simpan = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Simpan",
    );
    expect(simpan?.disabled).toBe(true);

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
