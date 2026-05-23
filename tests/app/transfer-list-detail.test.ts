import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);
const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <T>(initialValue: T): UseStateTuple<T> =>
      mockUseState(initialValue) as UseStateTuple<T>,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]): void => {
      mockUseEffect(effect, deps);
    },
    useCallback: <T extends (...args: unknown[]) => unknown>(
      fn: T,
      deps?: unknown[],
    ): T => mockUseCallback(fn, deps) as T,
  };
});

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null as unknown,
    data: undefined as unknown,
    reset: vi.fn(),
  }),
  useQuery: () => ({
    data: undefined as unknown,
    error: null as unknown,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue({ data: undefined }),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    fetchQuery: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/components/inventory/TransferForm", () => ({
  TransferForm: (): null => null,
}));

vi.mock("@/components/inventory/TransferTable", () => ({
  TransferTable: (): null => null,
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
  }) => (isOpen ? React.createElement("div", null, children) : null),
}));

vi.mock("@/components/ui/ImageLightbox", () => ({
  ImageLightbox: (): null => null,
}));

vi.mock("next/image", () => ({
  default: (): null => null,
}));

import TransferPage, {
  fetchTransferDetail,
} from "@/app/admin/inventory/transfer/TransferList";

describe("fetchTransferDetail", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseState.mockImplementation((initialValue: unknown) => [
      initialValue,
      vi.fn(),
    ]);
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
  });

  it("loads detail transfer from detail endpoint", async () => {
    const getWithAuth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          transfer: {
            id: "transfer-1",
            kodeTransfer: "TRF-001",
            masuk: {
              tanggal: "2026-01-01T08:00:00.000Z",
              keterangan: "Transfer dari Gudang Pusat",
            },
            keluar: {
              tanggal: "2026-01-01T07:00:00.000Z",
              keterangan: "Transfer ke Gudang Cabang",
            },
          },
        },
      }),
    });

    const result = await fetchTransferDetail(getWithAuth, "transfer-1");

    expect(getWithAuth).toHaveBeenCalledWith(
      "/api/inventory/transfer/transfer-1",
    );
    expect(result).toMatchObject({
      id: "transfer-1",
      kodeTransfer: "TRF-001",
      masuk: {
        keterangan: "Transfer dari Gudang Pusat",
      },
      keluar: {
        keterangan: "Transfer ke Gudang Cabang",
      },
    });
  });
});

describe("TransferPage related transactions", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
  });

  it("shows related transactions section when only keluar exists", () => {
    const transferDetail = {
      id: "transfer-1",
      kodeTransfer: "TRF-001",
      tanggal: "2026-01-01T07:00:00.000Z",
      barangId: "barang-1",
      jumlah: 3,
      kondisi: "BARU" as const,
      barang: {
        id: "barang-1",
        kode: "BRG-001",
        nama: "Kabel Fiber",
        satuan: "Meter",
      },
      dariGudang: {
        kode: "GDP",
        nama: "Gudang Pusat",
      },
      keGudang: {
        kode: "GDC",
        nama: "Gudang Cabang",
      },
      keluar: {
        tanggal: "2026-01-01T07:00:00.000Z",
        keterangan: "Transfer ke Gudang Cabang",
      },
    };

    mockUseState.mockImplementation((initialValue: unknown) => {
      // useState order:
      // 1. useTransferList → page (number)
      // 2. TransferPage → showForm (boolean)
      // 3. TransferPage → selectedTransfer (Transfer | null)
      // 4. TransferPage → showDetails (boolean)
      // 5. TransferDetailModal → lightboxOpen (boolean)
      // 6. TransferDetailModal → lightboxIndex (number)
      switch (mockUseState.mock.calls.length) {
        case 1:
          return [1, vi.fn()];
        case 2:
          return [false, vi.fn()];
        case 3:
          return [transferDetail, vi.fn()];
        case 4:
          return [true, vi.fn()];
        case 5:
          return [false, vi.fn()];
        case 6:
          return [0, vi.fn()];
        default:
          return [initialValue, vi.fn()];
      }
    });

    const markup = renderToStaticMarkup(React.createElement(TransferPage));

    expect(markup).toContain("Transaksi Terkait");
    expect(markup).toContain("Keluar:");
    expect(markup).toContain("Transfer ke Gudang Cabang");
  });
});
