// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useApi: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: mocks.useApi }));

import { ResellerStatusHistoryList } from "@/app/admin/resellers/ResellerStatusHistoryList";
import type { ResellerStatusHistoryItem } from "@/app/admin/resellers/types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ITEMS: readonly ResellerStatusHistoryItem[] = [
  {
    id: "h2",
    fromStatus: "ACTIVE",
    toStatus: "SUSPENDED",
    reason: "Tunggakan setoran",
    changedById: "admin-1",
    changedAt: "2026-11-03T02:00:00.000Z",
  },
  {
    id: "h1",
    fromStatus: null,
    toStatus: "INACTIVE",
    reason: null,
    changedById: null,
    changedAt: "2026-11-01T02:00:00.000Z",
  },
];

let container: HTMLElement;
let root: Root;

function mockQuery(overrides: Record<string, unknown> = {}) {
  mocks.useApi.mockReturnValue({
    data: ITEMS,
    error: null,
    isLoading: false,
    refetch: mocks.refetch,
    ...overrides,
  });
}

function render(statusChangedAt: string | null = null) {
  act(() =>
    root.render(
      <ResellerStatusHistoryList
        resellerId="r1"
        statusChangedAt={statusChangedAt}
      />,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ResellerStatusHistoryList", () => {
  it("menampilkan transisi, alasan, dan status awal", () => {
    mockQuery();
    render();

    const text = container.textContent ?? "";
    expect(mocks.useApi).toHaveBeenCalledWith(
      "/api/admin/resellers/r1/status-history?limit=10",
    );
    expect(text).toContain("Riwayat status");
    expect(text).toContain("Aktif → Ditangguhkan");
    expect(text).toContain("Tunggakan setoran");
    expect(text).toContain("Dibuat sebagai Nonaktif");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("menampilkan pesan kosong bila belum ada riwayat", () => {
    mockQuery({ data: [] });
    render();

    expect(container.textContent).toContain(
      "Belum ada perubahan status yang tercatat.",
    );
    expect(container.textContent).not.toContain("Tampilkan lebih banyak");
  });

  it("menampilkan galat dengan tombol coba lagi", () => {
    mockQuery({ data: undefined, error: new Error("Server sibuk") });
    render();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Riwayat status gagal dimuat",
    );
  });

  it("memuat lebih banyak saat daftar penuh", () => {
    const fullPage = Array.from({ length: 10 }, (_, index) => ({
      ...ITEMS[0],
      id: `h${index}`,
    }));
    mockQuery({ data: fullPage });
    render();

    const button = [...container.querySelectorAll("button")].find((element) =>
      element.textContent?.includes("Tampilkan lebih banyak"),
    );
    act(() => button?.click());

    expect(mocks.useApi).toHaveBeenLastCalledWith(
      "/api/admin/resellers/r1/status-history?limit=20",
    );
  });

  it("memuat ulang riwayat ketika status reseller berubah", () => {
    mockQuery();
    render("2026-11-01T00:00:00.000Z");
    mocks.refetch.mockClear();

    render("2026-11-03T00:00:00.000Z");

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
