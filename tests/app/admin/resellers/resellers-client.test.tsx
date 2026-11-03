// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("react-hot-toast", () => ({
  toast: {
    error: (message: string) => mockToastError(message),
    success: (message: string) => mockToastSuccess(message),
  },
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: () => true,
    isLoading: false,
    isSuperAdmin: false,
  }),
}));

vi.mock("@/components/ui/PageLoader", () => ({
  default: () => <div>Loading...</div>,
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
  }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
  ModalFooter: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import ResellersClient from "@/app/admin/resellers/ResellersClient";

type Reseller = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
};

function buildReseller(
  overrides: Partial<Reseller> & { id: string },
): Reseller {
  return {
    code: overrides.id.toUpperCase(),
    name: `Reseller ${overrides.id}`,
    email: null,
    phone: null,
    address: null,
    status: "ACTIVE",
    notes: null,
    ...overrides,
  };
}

type RouteReply = { status?: number; body: unknown };
type RouteHandler = (url: URL, init?: RequestInit) => RouteReply | undefined;

let routeHandler: RouteHandler;
const fetchCalls: { url: string; method: string }[] = [];

function jsonResponse({ status = 200, body }: RouteReply): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function listBody(items: Reseller[], page = 1, totalPages = 1) {
  return {
    success: true,
    data: items,
    meta: { page, limit: 20, total: items.length, totalPages },
  };
}

const ZERO_REPORT_FIGURES = {
  activeCustomers: 0,
  grossBilled: 0,
  paid: 0,
  commissionAccrued: 0,
  commissionSettled: 0,
  commissionPaid: 0,
  commissionAdjusted: 0,
};

function emptySuccess() {
  const noItems: unknown[] = [];
  return { body: { success: true, data: noItems } };
}

/** Balasan bawaan endpoint laporan bulanan: objek laporan kosong, bukan daftar. */
function emptyReportSuccess(url: URL) {
  return {
    body: {
      success: true,
      data: {
        period: url.searchParams.get("period") ?? "",
        rows: [] as unknown[],
        totals: ZERO_REPORT_FIGURES,
      },
    },
  };
}

function defaultReply(url: URL) {
  return url.pathname.endsWith("/report")
    ? emptyReportSuccess(url)
    : emptySuccess();
}

let root: Root | null = null;
let container: HTMLDivElement;

async function waitFor(predicate: () => unknown, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timeout after ${timeoutMs}ms`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

async function renderClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  await act(async () => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <ResellersClient />
      </QueryClientProvider>,
    );
  });
}

function buttonsByLabel(label: string): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    ),
  );
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Kartu mobile dirender setelah tabel desktop; ambil tombol versi mobile. */
function mobileButton(label: string): HTMLButtonElement {
  const mobileList = container.querySelector(".md\\:hidden.space-y-3");
  const button = mobileList?.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) throw new Error(`mobile button ${label} not found`);
  return button;
}

function desktopRow(text: string): HTMLTableRowElement {
  const row = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
    tr.textContent?.includes(text),
  );
  if (!row) throw new Error(`row ${text} not found`);
  return row as HTMLTableRowElement;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  fetchCalls.length = 0;
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://localhost");
      fetchCalls.push({
        url: `${url.pathname}${url.search}`,
        method: init?.method ?? "GET",
      });
      const reply = routeHandler(url, init) ?? defaultReply(url);
      return jsonResponse(reply);
    }),
  );
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.unstubAllGlobals();
});

describe("ResellersClient — pesan galat server (#10/#21)", () => {
  it("menampilkan field `error` dari API di toast, bukan pesan generik", async () => {
    const alpha = buildReseller({ id: "a" });
    routeHandler = (url, init) => {
      if (init?.method === "DELETE") {
        return {
          status: 409,
          body: {
            success: false,
            error: "Reseller masih dipakai pelanggan",
            code: "CONFLICT",
          },
        };
      }
      if (url.pathname === "/api/admin/resellers") {
        return { body: listBody([alpha]) };
      }
      return undefined;
    };
    await renderClient();
    await waitFor(() => buttonsByLabel("Hapus reseller Reseller a").length > 0);

    await click(buttonsByLabel("Hapus reseller Reseller a")[0]);
    await waitFor(() => mockToastError.mock.calls.length > 0);

    expect(mockToastError).toHaveBeenCalledWith(
      "Reseller masih dipakai pelanggan",
    );
  });

  it("menyertakan detail validasi field di toast", async () => {
    const alpha = buildReseller({ id: "a" });
    routeHandler = (url, init) => {
      if (init?.method === "PATCH") {
        return {
          status: 400,
          body: {
            success: false,
            error: "Validasi gagal",
            code: "VALIDATION_ERROR",
            details: { email: "Email tidak valid" },
          },
        };
      }
      if (url.pathname === "/api/admin/resellers") {
        return { body: listBody([alpha]) };
      }
      return undefined;
    };
    await renderClient();
    await waitFor(() => buttonsByLabel("Edit reseller Reseller a").length > 0);

    await click(buttonsByLabel("Edit reseller Reseller a")[0]);
    await click(buttonByText("Simpan")!);
    await waitFor(() => mockToastError.mock.calls.length > 0);

    const message = String(mockToastError.mock.calls[0][0]);
    expect(message).toContain("Validasi gagal");
    expect(message).toContain("Email tidak valid");
  });
});

describe("ResellersClient — paginasi (#8/#37)", () => {
  it("meminta page/limit dan bisa membuka halaman berikutnya", async () => {
    routeHandler = (url) => {
      if (url.pathname !== "/api/admin/resellers") return undefined;
      const page = Number(url.searchParams.get("page") ?? 1);
      const item = buildReseller({ id: page === 1 ? "p1" : "p21" });
      return { body: listBody([item], page, 2) };
    };
    await renderClient();
    await waitFor(() => container.textContent?.includes("Reseller p1"));

    expect(fetchCalls[0].url).toBe("/api/admin/resellers?page=1&limit=20");
    const nextPage = Array.from(
      container.querySelectorAll('nav[aria-label="Pagination"] button'),
    ).find((button) => button.textContent === "2");
    expect(nextPage).toBeDefined();

    await click(nextPage!);
    await waitFor(() => container.textContent?.includes("Reseller p21"));

    expect(
      fetchCalls.some(
        (call) => call.url === "/api/admin/resellers?page=2&limit=20",
      ),
    ).toBe(true);
  });
});

function paginationButton(label: string): HTMLButtonElement | undefined {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Pagination"] button',
    ),
  ).find((button) => button.textContent === label);
}

describe("ResellersClient — batas halaman paginasi", () => {
  it("gagal memuat halaman 2 tetap menampilkan galat, tidak mundur ke halaman 1", async () => {
    routeHandler = (url) => {
      if (url.pathname !== "/api/admin/resellers") return undefined;
      const page = Number(url.searchParams.get("page") ?? 1);
      if (page === 2) {
        return {
          status: 500,
          body: { success: false, error: "Server sedang gangguan" },
        };
      }
      return { body: listBody([buildReseller({ id: "p1" })], page, 3) };
    };
    await renderClient();
    await waitFor(() => container.textContent?.includes("Reseller p1"));

    await click(paginationButton("2")!);
    await waitFor(() =>
      container.textContent?.includes("Gagal memuat data reseller"),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain("Gagal memuat data reseller");
    expect(container.textContent).toContain("Server sedang gangguan");
    const listCalls = fetchCalls.filter((call) =>
      call.url.startsWith("/api/admin/resellers?"),
    );
    expect(listCalls.at(-1)?.url).toBe("/api/admin/resellers?page=2&limit=20");
  });

  it("mundur ke halaman 1 saat total menjadi 0", async () => {
    let isEmpty = false;
    routeHandler = (url) => {
      if (url.pathname !== "/api/admin/resellers") return undefined;
      const page = Number(url.searchParams.get("page") ?? 1);
      if (isEmpty) {
        return {
          body: {
            success: true,
            data: [],
            meta: { page, limit: 20, total: 0, totalPages: 0 },
          },
        };
      }
      return { body: listBody([buildReseller({ id: `p${page}` })], page, 2) };
    };
    await renderClient();
    await waitFor(() => container.textContent?.includes("Reseller p1"));

    isEmpty = true;
    await click(paginationButton("2")!);
    await waitFor(() =>
      fetchCalls.some(
        (call) => call.url === "/api/admin/resellers?page=2&limit=20",
      ),
    );
    await waitFor(
      () =>
        fetchCalls.filter(
          (call) => call.url === "/api/admin/resellers?page=1&limit=20",
        ).length >= 2,
    );

    expect(
      fetchCalls
        .filter((call) => call.url.startsWith("/api/admin/resellers?"))
        .at(-1)?.url,
    ).toBe("/api/admin/resellers?page=1&limit=20");
  });
});

describe("ResellersClient — pilihan reseller (#27/#28)", () => {
  it("klik Hapus di kartu mobile tidak memilih reseller yang dihapus", async () => {
    let items = [buildReseller({ id: "a" })];
    routeHandler = (url, init) => {
      if (init?.method === "DELETE") {
        items = [];
        return { body: { success: true, data: { message: "ok" } } };
      }
      if (url.pathname === "/api/admin/resellers") {
        return { body: listBody(items) };
      }
      return undefined;
    };
    await renderClient();
    await waitFor(() => buttonsByLabel("Hapus reseller Reseller a").length > 0);

    await click(mobileButton("Hapus reseller Reseller a"));
    await waitFor(() => mockToastSuccess.mock.calls.length > 0);
    await waitFor(() => !container.textContent?.includes("Reseller a"));

    expect(container.textContent).toContain(
      "Pilih reseller untuk melihat outlet",
    );
    expect(
      fetchCalls.some((call) => call.url.startsWith("/api/admin/resellers/a/")),
    ).toBe(false);
  });

  it("panel memakai data segar setelah reseller terpilih diedit", async () => {
    let current = buildReseller({ id: "a", name: "Nama Lama" });
    routeHandler = (url, init) => {
      if (init?.method === "PATCH") {
        current = { ...current, name: "Nama Baru", status: "INACTIVE" };
        return { body: { success: true, data: current } };
      }
      if (url.pathname === "/api/admin/resellers") {
        return { body: listBody([current]) };
      }
      if (url.pathname === "/api/admin/resellers/a") {
        return { body: { success: true, data: current } };
      }
      return undefined;
    };
    await renderClient();
    await waitFor(() => container.textContent?.includes("Nama Lama"));

    await click(desktopRow("Nama Lama"));
    await waitFor(() => buttonByText("Outlet") !== undefined);

    await click(buttonsByLabel("Edit reseller Nama Lama")[0]);
    await click(buttonByText("Simpan")!);
    await waitFor(() => mockToastSuccess.mock.calls.length > 0);
    await waitFor(() => container.textContent?.includes("Nama Baru"));

    expect(container.textContent).not.toContain("Nama Lama");
    expect(container.textContent).toContain("Outlet resellerNama Baru");
    expect(buttonByText("Outlet")).toBeUndefined();
  });
});

describe("ResellersClient — kegagalan memuat (#29)", () => {
  it("menampilkan keadaan galat dengan tombol coba lagi, bukan empty state", async () => {
    let isFailing = true;
    routeHandler = (url) => {
      if (url.pathname !== "/api/admin/resellers") return undefined;
      if (isFailing) {
        return {
          status: 403,
          body: {
            success: false,
            error: "Fitur reseller tidak aktif",
            code: "FORBIDDEN",
          },
        };
      }
      return { body: listBody([buildReseller({ id: "a" })]) };
    };
    await renderClient();
    await waitFor(() =>
      container.textContent?.includes("Gagal memuat data reseller"),
    );

    expect(container.textContent).toContain("Fitur reseller tidak aktif");
    expect(container.textContent).not.toContain("Belum ada reseller");

    isFailing = false;
    await click(buttonByText("Coba lagi")!);
    await waitFor(() => container.textContent?.includes("Reseller a"));

    expect(container.textContent).not.toContain("Gagal memuat data reseller");
  });
});
