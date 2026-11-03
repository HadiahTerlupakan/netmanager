// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  getWithAuth: vi.fn(),
  ensurePermission: vi.fn(),
  serverHasPermission: vi.fn(async (_permission: string) => true),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: (permission: string) => mocks.permissions.has(permission),
  }),
}));
vi.mock("@/lib/rbac", () => ({
  ensurePermission: mocks.ensurePermission,
  hasPermission: mocks.serverHasPermission,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    scroll?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/inventory/BarangTable", () => ({
  BarangTable: () => <div data-testid="barang-table" />,
}));
vi.mock("@/components/inventory/InventoryStats", () => ({
  InventoryStats: () => <div data-testid="inventory-stats" />,
}));
vi.mock("@/lib/api-client", () => ({
  getWithAuth: mocks.getWithAuth,
  deleteWithAuth: vi.fn(),
}));
vi.mock("@/app/admin/inventory/barang/JasaFormModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="jasa-form-modal" /> : null,
}));
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import BarangList from "@/app/admin/inventory/barang/BarangList";
import BarangPage from "@/app/admin/inventory/barang/page";
import JasaPage from "@/app/admin/inventory/jasa/page";
import {
  buildInventoryCatalogTabHref,
  resolveInventoryCatalogTab,
} from "@/app/admin/inventory/barang/catalogTabs";
import type { InventoryCatalogTab } from "@/app/admin/inventory/barang/catalogTabs";
import type { Jasa } from "@/app/admin/inventory/restock/types";

const JASA_SAMPLE: Jasa = {
  id: "jasa-1",
  kode: "JS-001",
  nama: "Tanam Tiang",
  satuan: "job",
  hargaEstimasi: 150000,
  status: "ACTIVE",
  deskripsi: null,
  supplier: null,
};

let container: HTMLDivElement;
let root: Root;

function grant(...permissions: string[]) {
  mocks.permissions = new Set(permissions);
}

async function renderList(activeTab: InventoryCatalogTab) {
  await act(async () => {
    root.render(<BarangList activeTab={activeTab} />);
  });
}

function tabLinks(): HTMLAnchorElement[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      'nav[aria-label="Jenis katalog"] a',
    ),
  );
}

function headingText(): string | null | undefined {
  return container.querySelector("h2")?.textContent;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.getWithAuth.mockReset();
  mocks.getWithAuth.mockResolvedValue(
    new Response(JSON.stringify({ data: { items: [JASA_SAMPLE] } }), {
      status: 200,
    }),
  );
  mocks.ensurePermission.mockReset();
  mocks.redirect.mockClear();
  mocks.serverHasPermission.mockReset();
  mocks.serverHasPermission.mockResolvedValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Tab Barang dan Jasa di Manajemen Barang", () => {
  it("tab barang menampilkan tabel barang, bukan daftar jasa", async () => {
    grant("barang:read", "jasa:read", "barang:create", "jasa:create");
    await renderList("barang");

    expect(
      container.querySelector('[data-testid="barang-table"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="inventory-stats"]'),
    ).not.toBeNull();
    expect(headingText()).toBe("Daftar Barang");
    expect(mocks.getWithAuth).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Tanam Tiang");
  });

  it("tab jasa menampilkan daftar jasa dan menyembunyikan tabel barang", async () => {
    grant("barang:read", "jasa:read");
    await renderList("jasa");

    expect(container.querySelector('[data-testid="barang-table"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="inventory-stats"]'),
    ).not.toBeNull();
    expect(headingText()).toBe("Daftar Jasa");
    expect(mocks.getWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/inventory/jasa?"),
    );
    expect(container.textContent).toContain("Tanam Tiang");
  });

  it("tautan tab memakai ?tab=jasa dan menandai tab aktif", async () => {
    grant("barang:read", "jasa:read");
    await renderList("jasa");

    const links = tabLinks();
    expect(links.map((link) => link.textContent)).toEqual(["Barang", "Jasa"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/inventory/barang",
      "/admin/inventory/barang?tab=jasa",
    ]);
    expect(links[1].getAttribute("aria-current")).toBe("page");
    expect(links[0].getAttribute("aria-current")).toBeNull();
  });

  it("tab jasa tidak muncul tanpa izin jasa:read", async () => {
    grant("barang:read", "barang:create");
    await renderList("barang");

    expect(tabLinks()).toHaveLength(0);
    expect(container.textContent).not.toContain("Jasa");
  });

  it("tombol header mengikuti tab: Tambah Barang di tab barang", async () => {
    grant("barang:read", "jasa:read", "barang:create", "jasa:create");
    await renderList("barang");

    const addLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/admin/inventory/barang/new"]',
    );
    expect(addLink?.textContent).toContain("Tambah Barang");
    expect(container.textContent).not.toContain("Tambah Jasa");
  });

  it("tombol header mengikuti tab: Tambah Jasa membuka modal jasa", async () => {
    grant("barang:read", "jasa:read", "barang:create", "jasa:create");
    await renderList("jasa");

    expect(container.textContent).not.toContain("Tambah Barang");
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Tambah Jasa"),
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.click();
    });
    expect(
      container.querySelector('[data-testid="jasa-form-modal"]'),
    ).not.toBeNull();
  });

  it("tombol tambah disembunyikan tanpa izin create tab masing-masing", async () => {
    grant("barang:read", "jasa:read", "jasa:create");
    await renderList("barang");
    expect(container.textContent).not.toContain("Tambah Barang");

    grant("barang:read", "jasa:read", "barang:create");
    await renderList("jasa");
    expect(container.textContent).not.toContain("Tambah Jasa");
  });

  it("pengguna jasa-saja tidak melihat baris tab, statistik, atau Tambah Barang", async () => {
    grant("jasa:read", "jasa:create");
    await renderList("jasa");

    expect(tabLinks()).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="inventory-stats"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("Tambah Barang");
    expect(headingText()).toBe("Daftar Jasa");
    expect(container.textContent).toContain("Tanam Tiang");
  });
});

describe("URL tab katalog", () => {
  it("menerjemahkan query tab dan jatuh ke barang untuk nilai asing", () => {
    expect(resolveInventoryCatalogTab("jasa")).toBe("jasa");
    expect(resolveInventoryCatalogTab(["jasa", "barang"])).toBe("jasa");
    expect(resolveInventoryCatalogTab(undefined)).toBe("barang");
    expect(resolveInventoryCatalogTab("lainnya")).toBe("barang");
    expect(buildInventoryCatalogTabHref("barang")).toBe(
      "/admin/inventory/barang",
    );
    expect(buildInventoryCatalogTabHref("jasa")).toBe(
      "/admin/inventory/barang?tab=jasa",
    );
  });

  it("?tab=jasa membuka tab jasa dan dijaga jasa:read", async () => {
    const element = await BarangPage({
      searchParams: Promise.resolve({ tab: "jasa" }),
    });

    expect(mocks.ensurePermission).toHaveBeenCalledWith("jasa:read");
    expect(element.props).toEqual({ activeTab: "jasa" });
  });

  it("tanpa query membuka tab barang dan dijaga barang:read", async () => {
    const element = await BarangPage({ searchParams: Promise.resolve({}) });

    expect(mocks.ensurePermission).toHaveBeenCalledWith("barang:read");
    expect(element.props).toEqual({ activeTab: "barang" });
  });

  it("tanpa query, pengguna jasa-saja dialihkan ke tab jasa", async () => {
    mocks.serverHasPermission.mockImplementation(
      async (permission: string) => permission === "jasa:read",
    );

    await expect(
      BarangPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/inventory/barang?tab=jasa");
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it("tanpa query dan tanpa izin apa pun tetap ditolak lewat barang:read", async () => {
    mocks.serverHasPermission.mockResolvedValue(false);

    await BarangPage({ searchParams: Promise.resolve({}) });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.ensurePermission).toHaveBeenCalledWith("barang:read");
  });

  it("alamat lama /admin/inventory/jasa dialihkan ke tab jasa", () => {
    expect(() => JasaPage()).toThrow(
      "NEXT_REDIRECT:/admin/inventory/barang?tab=jasa",
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/inventory/barang?tab=jasa",
    );
  });
});
