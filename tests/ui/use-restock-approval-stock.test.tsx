// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetWithAuth = vi.fn();
vi.mock("@/lib/api-client", () => ({
  getWithAuth: (...args: unknown[]) => mockGetWithAuth(...args),
}));

import {
  type RestockApprovalStockState,
  useRestockApprovalStock,
} from "@/app/admin/inventory/restock/useRestockApprovalStock";

let latest: RestockApprovalStockState = { status: "idle" };
function report(state: RestockApprovalStockState): void {
  latest = state;
}
function Harness({
  requestId,
}: {
  requestId: string | null;
}): React.ReactElement | null {
  const state = useRestockApprovalStock(requestId);
  useEffect(() => report(state), [state]);
  return null;
}

function okResponse(stok: number) {
  return {
    ok: true,
    json: async () => ({
      data: {
        gudangId: "g-1",
        gudangName: "Gudang A",
        fetchedAt: "2026-11-11T03:00:00.000Z",
        items: [
          {
            barangId: "barang-1",
            stok,
            stokBaru: stok,
            stokBekas: 0,
            stokRusak: 0,
            minStok: null as number | null,
          },
        ],
      },
    }),
  };
}

let container: HTMLDivElement;
let root: Root;

async function renderWith(requestId: string | null) {
  await act(async () => {
    root.render(<Harness requestId={requestId} />);
  });
}

describe("useRestockApprovalStock", () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mockGetWithAuth.mockReset();
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
  });

  it("tidak memuat apa pun selama modal tertutup", async () => {
    await renderWith(null);

    expect(latest).toEqual({ status: "idle" });
    expect(mockGetWithAuth).not.toHaveBeenCalled();
  });

  it("memuat stok pengajuan yang dibuka", async () => {
    mockGetWithAuth.mockResolvedValue(okResponse(7));

    await renderWith("pr-1");

    expect(mockGetWithAuth).toHaveBeenCalledWith(
      "/api/inventory/restock/requests/pr-1/stok",
    );
    expect(latest.status).toBe("ready");
    if (latest.status === "ready") {
      expect(latest.byBarangId.get("barang-1")?.stok).toBe(7);
      expect(latest.gudangName).toBe("Gudang A");
    }
  });

  it("membaca ulang stok saat pengajuan yang sama dibuka lagi", async () => {
    mockGetWithAuth
      .mockResolvedValueOnce(okResponse(7))
      .mockResolvedValueOnce(okResponse(3));

    await renderWith("pr-1");
    await renderWith(null);
    await renderWith("pr-1");

    expect(mockGetWithAuth).toHaveBeenCalledTimes(2);
    expect(
      latest.status === "ready" && latest.byBarangId.get("barang-1")?.stok,
    ).toBe(3);
  });

  it("gagal: pesan server ditampilkan, Coba lagi memuat ulang", async () => {
    mockGetWithAuth
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "Pengajuan ini untuk gudang di site lain.",
        }),
      })
      .mockResolvedValueOnce(okResponse(5));

    await renderWith("pr-1");
    expect(latest).toMatchObject({
      status: "error",
      message: "Pengajuan ini untuk gudang di site lain.",
    });

    await act(async () => {
      if (latest.status === "error") latest.retry();
    });
    expect(latest.status).toBe("ready");
  });
});
