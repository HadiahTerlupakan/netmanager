// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockResponsiveTable = vi.fn((_props?: unknown) => null);
const mockHasPermission = vi.fn<(permission: string) => boolean>(() => true);
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    title,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    href: string;
    className?: string;
    title?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} className={className} title={title} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: mockHasPermission,
    isLoading: false,
    isSuperAdmin: false,
  }),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    title,
    className,
    disabled,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    className?: string;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  buttonVariants: () => "btn",
}));

vi.mock("@/components/common/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/ui/PageLoader", () => ({
  default: () => <div>Loading...</div>,
}));

vi.mock("@/components/ui/ResponsiveTable", () => ({
  default: (props: unknown) => {
    mockResponsiveTable(props);
    const tableProps = props as {
      data: Array<{ id: string; nama: string }>;
      page?: number;
      onPageChange?: (page: number) => void;
      renderActions?: (item: { id: string; nama: string }) => React.ReactNode;
    };

    return (
      <div>
        <div data-testid="table-page">{tableProps.page}</div>
        <div data-testid="table-data">
          {tableProps.data.map((item) => (
            <div key={item.id}>
              <span>{item.nama}</span>
              <div>{tableProps.renderActions?.(item)}</div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => tableProps.onPageChange?.(3)}>
          Pindah halaman 3
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/common/SiteFilter", () => ({
  SiteFilter: ({
    onSiteChange,
  }: {
    onSiteChange: (siteId?: string) => void;
  }) => (
    <button type="button" onClick={() => onSiteChange("site-1")}>
      Pilih Site 1
    </button>
  ),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("axios", () => ({
  default: {
    put: vi.fn(),
  },
  isAxiosError: () => false,
}));

import CanvasingList from "@/app/admin/marketing/canvasing/CanvasingList";

function getRequestUrl(input: string | URL | Request) {
  if (typeof input === "string") {
    return new URL(input, "https://admin.localhost");
  }

  if (input instanceof URL) {
    return new URL(input.toString());
  }

  return new URL(input.url, "https://admin.localhost");
}

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function createFetchResponse(url: string) {
  const requestUrl = new URL(url, "https://admin.localhost");
  const search = requestUrl.searchParams.get("search");
  const status = requestUrl.searchParams.get("status");
  const siteId = requestUrl.searchParams.get("siteId");

  return {
    ok: true,
    json: async () => ({
      data: [
        {
          id: `${search || "base"}-${status || "all"}-${siteId || "all"}`,
          nama: search
            ? `Hasil server ${search}`
            : status
              ? `Data server status ${status}`
              : "Data server awal",
          paket: "Paket 30 Mbps",
          alamat: "Jl. Server Side",
          status: status || "APPROVED",
          createdAt: "2026-04-27T10:00:00.000Z",
          sales: { name: "Sales A" },
          user: { name: "User A", email: "user@example.com" },
          pointClaims: null as null,
        },
      ],
      total: 1,
      page: Number(requestUrl.searchParams.get("page") || "1"),
      limit: Number(requestUrl.searchParams.get("limit") || "10"),
      summary: {
        total: 12,
        pending: 4,
        approved: 5,
        rejected: 2,
        pendingClaims: 1,
      },
    }),
  };
}

function createDeferredResponse() {
  let resolveResponse:
    | ((value: ReturnType<typeof createFetchResponse>) => void)
    | null = null;
  const promise = new Promise<ReturnType<typeof createFetchResponse>>(
    (resolve) => {
      resolveResponse = resolve;
    },
  );

  return {
    promise,
    resolve(url: string) {
      resolveResponse?.(createFetchResponse(url));
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function getFetchUrls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([input]) =>
    getRequestUrl(input as string | URL | Request),
  );
}

function findRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  predicate: (url: URL) => boolean,
) {
  return getFetchUrls(fetchMock).find(predicate);
}

function hasRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  predicate: (url: URL) => boolean,
) {
  return getFetchUrls(fetchMock).some(predicate);
}

describe("CanvasingList", () => {
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockResponsiveTable.mockClear();
    mockHasPermission.mockReset();
    mockHasPermission.mockReturnValue(true);
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);

    fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = getRequestUrl(input).toString();
      return createFetchResponse(url);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("mengirim search ke API, menampilkan KPI summary, dan memakai data server tanpa filter client-side", async () => {
    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const searchInput = container.querySelector(
      "input[type='text']",
    ) as HTMLInputElement;

    await act(async () => {
      setInputValue(searchInput, "fiber");
      await flushPromises();
    });

    const searchRequest = findRequest(
      fetchMock,
      (url) => url.searchParams.get("search") === "fiber",
    );

    expect(searchRequest).toBeDefined();
    expect(searchRequest?.searchParams.get("page")).toBe("1");
    expect(container.textContent).toContain("Total");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Pending Claim");

    const lastTableCall = mockResponsiveTable.mock.calls.at(-1);
    expect(lastTableCall?.[0]).toMatchObject({
      data: [
        expect.objectContaining({
          nama: "Hasil server fiber",
        }),
      ],
    });
  });

  it("reset page ke 1 tanpa request stale saat site dan status filter berubah", async () => {
    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const pageButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Pindah halaman 3",
    );

    await act(async () => {
      pageButton?.click();
      await flushPromises();
    });

    expect(
      findRequest(fetchMock, (url) => url.searchParams.get("page") === "3"),
    ).toBeDefined();

    fetchMock.mockClear();

    const siteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Pilih Site 1",
    );

    await act(async () => {
      siteButton?.click();
      await flushPromises();
    });

    const siteRequest = findRequest(
      fetchMock,
      (url) => url.searchParams.get("siteId") === "site-1",
    );

    expect(siteRequest).toBeDefined();
    expect(siteRequest?.searchParams.get("page")).toBe("1");
    expect(
      hasRequest(
        fetchMock,
        (url) =>
          url.searchParams.get("siteId") === "site-1" &&
          url.searchParams.get("page") === "3",
      ),
    ).toBe(false);

    fetchMock.mockClear();

    const approvedButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Approved"));

    expect(approvedButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      approvedButton?.click();
      await flushPromises();
    });

    const approvedRequest = findRequest(
      fetchMock,
      (url) =>
        url.searchParams.get("status") === "APPROVED" &&
        url.searchParams.get("siteId") === "site-1",
    );

    expect(approvedRequest).toBeDefined();
    expect(approvedRequest?.searchParams.get("page")).toBe("1");
    expect(
      hasRequest(
        fetchMock,
        (url) =>
          url.searchParams.get("status") === "APPROVED" &&
          url.searchParams.get("siteId") === "site-1" &&
          url.searchParams.get("page") === "3",
      ),
    ).toBe(false);
    expect(approvedButton?.getAttribute("aria-pressed")).toBe("true");
  });

  it("reset page ke 1 tanpa request stale saat search berubah", async () => {
    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const pageButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Pindah halaman 3",
    );

    await act(async () => {
      pageButton?.click();
      await flushPromises();
    });

    fetchMock.mockClear();

    const searchInput = container.querySelector(
      "input[type='text']",
    ) as HTMLInputElement;

    await act(async () => {
      setInputValue(searchInput, "fiber");
      await flushPromises();
    });

    const searchRequest = findRequest(
      fetchMock,
      (url) => url.searchParams.get("search") === "fiber",
    );

    expect(searchRequest).toBeDefined();
    expect(searchRequest?.searchParams.get("page")).toBe("1");
    expect(
      hasRequest(
        fetchMock,
        (url) =>
          url.searchParams.get("search") === "fiber" &&
          url.searchParams.get("page") === "3",
      ),
    ).toBe(false);
  });

  it("mempertahankan hasil request terbaru saat response datang tidak berurutan", async () => {
    const initialRequest = createDeferredResponse();
    const staleRequest = createDeferredResponse();
    const latestRequest = createDeferredResponse();
    let requestIndex = 0;

    fetchMock = vi.fn((_input: string | URL | Request) => {
      requestIndex += 1;
      if (requestIndex === 1) {
        return initialRequest.promise;
      }
      if (requestIndex === 2) {
        return staleRequest.promise;
      }
      return latestRequest.promise;
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const initialRequestUrl = getRequestUrl(
      fetchMock.mock.calls[0][0] as string | URL | Request,
    );

    await act(async () => {
      initialRequest.resolve(initialRequestUrl.toString());
      await flushPromises();
    });

    const pendingButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Pending"),
    );
    const approvedButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Approved"));

    expect(pendingButton).toBeDefined();
    expect(approvedButton).toBeDefined();

    await act(async () => {
      pendingButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      approvedButton?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const staleRequestUrl = getRequestUrl(
      fetchMock.mock.calls[1][0] as string | URL | Request,
    );
    const latestRequestUrl = getRequestUrl(
      fetchMock.mock.calls[2][0] as string | URL | Request,
    );

    expect(staleRequestUrl.searchParams.get("status")).toBe("PENDING");
    expect(latestRequestUrl.searchParams.get("status")).toBe("APPROVED");

    await act(async () => {
      latestRequest.resolve(latestRequestUrl.toString());
      await flushPromises();
    });

    expect(container.textContent).toContain("Data server status APPROVED");
    expect(container.textContent).not.toContain("Data server status PENDING");

    await act(async () => {
      staleRequest.resolve(staleRequestUrl.toString());
      await flushPromises();
    });

    expect(container.textContent).toContain("Data server status APPROVED");
    expect(container.textContent).not.toContain("Data server status PENDING");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("memakai modal terstruktur untuk konfirmasi delete dan cancel approval", async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);

    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const deleteButton = container.querySelector(
      'button[aria-label="Hapus canvasing Data server awal"]',
    ) as HTMLButtonElement;

    await act(async () => {
      deleteButton.click();
      await flushPromises();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      container.querySelector('[role="dialog"][aria-modal="true"]')
        ?.textContent,
    ).toContain("Hapus request canvasing atas nama Data server awal?");

    const confirmButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Hapus",
    ) as HTMLButtonElement;

    await act(async () => {
      confirmButton.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/marketing/canvasing/base-all-all",
      { method: "DELETE" },
    );
  });

  it("memakai modal input alasan untuk reject claim", async () => {
    const promptSpy = vi.fn(() => "Alasan lama");
    vi.stubGlobal("prompt", promptSpy);
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async (): Promise<Record<string, unknown>> => ({
        data: [
          {
            id: "claim-1",
            nama: "Pelanggan Claim",
            paket: "Paket 50 Mbps",
            alamat: "Jl. Claim",
            status: "PENDING",
            createdAt: "2026-04-27T10:00:00.000Z",
            sales: { name: "Sales B" },
            user: { name: "User B", email: "userb@example.com" },
            pointClaims: [
              {
                id: "point-1",
                status: "PENDING",
                buktiUrls: [],
                pointValue: 25,
                createdAt: "2026-04-27T11:00:00.000Z",
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        summary: {
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          pendingClaims: 1,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const axios = await import("axios");
    vi.mocked(axios.default.put).mockResolvedValue({});

    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const reviewClaimButton = container.querySelector(
      'button[aria-label="Review claim poin untuk Pelanggan Claim"]',
    ) as HTMLButtonElement;

    await act(async () => {
      reviewClaimButton.click();
      await flushPromises();
    });

    const rejectButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Tolak Claim",
    ) as HTMLButtonElement;

    await act(async () => {
      rejectButton.click();
      await flushPromises();
    });

    expect(promptSpy).not.toHaveBeenCalled();
    const textarea = container.querySelector(
      'textarea[aria-label="Alasan penolakan claim"]',
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setInputValue(textarea, "Bukti tidak valid");
      await flushPromises();
    });

    const submitRejectButton = Array.from(
      container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Kirim Penolakan",
    ) as HTMLButtonElement;

    await act(async () => {
      submitRejectButton.click();
      await flushPromises();
    });

    expect(axios.default.put).toHaveBeenCalledWith(
      "/api/marketing/point-claims/point-1",
      { action: "reject", notes: "Bukti tidak valid" },
    );
  });

  it("menampilkan review claim untuk verifier tanpa membuka edit atau cancel approval", async () => {
    mockHasPermission.mockImplementation(
      (permission: string) => permission === "canvasing:verify",
    );
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async (): Promise<Record<string, unknown>> => ({
        data: [
          {
            id: "pending-claim",
            nama: "Pelanggan Pending Claim",
            paket: "Paket 50 Mbps",
            alamat: "Jl. Claim",
            status: "PENDING",
            createdAt: "2026-04-27T10:00:00.000Z",
            sales: { name: "Sales B" },
            user: { name: "User B", email: "userb@example.com" },
            pointClaims: [
              {
                id: "point-1",
                status: "PENDING",
                buktiUrls: [],
                pointValue: 25,
                createdAt: "2026-04-27T11:00:00.000Z",
              },
            ],
          },
          {
            id: "approved-claim",
            nama: "Pelanggan Approved",
            paket: "Paket 30 Mbps",
            alamat: "Jl. Approved",
            status: "APPROVED",
            createdAt: "2026-04-27T10:00:00.000Z",
            sales: { name: "Sales C" },
            user: { name: "User C", email: "userc@example.com" },
            pointClaims: null,
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
        summary: {
          total: 2,
          pending: 1,
          approved: 1,
          rejected: 0,
          pendingClaims: 1,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    expect(
      container.querySelector(
        'button[aria-label="Review claim poin untuk Pelanggan Pending Claim"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'a[aria-label="Edit canvasing Pelanggan Pending Claim"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="Batalkan approval canvasing Pelanggan Approved"]',
      ),
    ).toBeNull();
  });

  it("menyediakan label aksesibel untuk pencarian, aksi ikon, dan dialog modal", async () => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "claim-1",
            nama: "Pelanggan Claim",
            paket: "Paket 50 Mbps",
            alamat: "Jl. Claim",
            status: "PENDING",
            createdAt: "2026-04-27T10:00:00.000Z",
            sales: { name: "Sales B" },
            user: { name: "User B", email: "userb@example.com" },
            pointClaims: [
              {
                id: "point-1",
                status: "PENDING",
                buktiUrls: ["https://example.com/bukti-1.jpg"],
                pointValue: 25,
                createdAt: "2026-04-27T11:00:00.000Z",
                keterangan: "Bukti pemasangan",
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        summary: {
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          pendingClaims: 1,
        },
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      createRoot(container).render(<CanvasingList />);
      await flushPromises();
    });

    const searchInput = container.querySelector(
      'input[aria-label="Cari canvasing berdasarkan nama atau alamat"]',
    );
    expect(searchInput).not.toBeNull();

    const detailLink = container.querySelector(
      'a[aria-label="Lihat detail canvasing Pelanggan Claim"]',
    );
    const editLink = container.querySelector(
      'a[aria-label="Edit canvasing Pelanggan Claim"]',
    );
    const reviewClaimButton = Array.from(
      container.querySelectorAll("button"),
    ).find(
      (button) =>
        button.getAttribute("aria-label") ===
        "Review claim poin untuk Pelanggan Claim",
    );

    expect(detailLink).not.toBeNull();
    expect(editLink).not.toBeNull();
    expect(reviewClaimButton).toBeDefined();

    await act(async () => {
      reviewClaimButton?.click();
      await flushPromises();
    });

    const claimDialog = container.querySelector(
      '[role="dialog"][aria-modal="true"][aria-labelledby="claim-modal-title"]',
    );
    expect(claimDialog).not.toBeNull();
    expect(
      claimDialog?.querySelector("#claim-modal-title")?.textContent,
    ).toContain("Review Claim Poin");

    const closeClaimButton = claimDialog?.querySelector(
      'button[aria-label="Tutup modal review claim poin"]',
    );
    expect(closeClaimButton).not.toBeNull();

    const zoomTrigger = claimDialog?.querySelector('img[alt="Bukti 1"]');
    expect(zoomTrigger).not.toBeNull();

    await act(async () => {
      zoomTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    const zoomDialog = container.querySelector(
      '[role="dialog"][aria-modal="true"][aria-labelledby="zoom-image-modal-title"]',
    );
    expect(zoomDialog).not.toBeNull();
    expect(zoomDialog?.className).toContain("z-[60]");
    expect(
      zoomDialog?.querySelector("#zoom-image-modal-title")?.textContent,
    ).toContain("Preview bukti claim poin");

    const closeZoomButton = zoomDialog?.querySelector(
      'button[aria-label="Tutup preview gambar"]',
    );
    expect(closeZoomButton).not.toBeNull();

    await act(async () => {
      if (closeZoomButton) {
        (closeZoomButton as HTMLButtonElement).click();
      }
      await flushPromises();
    });

    expect(
      container.querySelector(
        '[role="dialog"][aria-modal="true"][aria-labelledby="zoom-image-modal-title"]',
      ),
    ).toBeNull();
  });
});
