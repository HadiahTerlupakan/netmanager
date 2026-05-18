import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);
const mockUseEffect = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <T,>(initialValue: T): UseStateTuple<T> =>
      mockUseState(initialValue) as UseStateTuple<T>,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]): void => {
      mockUseEffect(effect, deps);
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

// Mock useApi: barang data berisi 1 item supaya selectedBarang resolved.
// Gudang data sengaja kosong supaya test scenario "daftar gudang tidak
// memuat gudang sumber terpilih" tetap relevan — fallback ke
// stockGudangSumber state.
interface MockUseApiResult {
  data: unknown;
  isLoading: boolean;
  error: unknown;
  mutate: () => Promise<unknown>;
}

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (url: string | null): MockUseApiResult => {
    if (url?.includes("/api/inventory/barang")) {
      return {
        data: {
          barangs: [
            {
              id: "barang-1",
              kode: "BRG-001",
              nama: "Modem",
              satuan: "pcs",
              stockPerGudang: [] as unknown[],
            },
          ],
        },
        isLoading: false,
        error: null,
        mutate: vi.fn().mockResolvedValue(undefined),
      };
    }
    if (url?.includes("/api/inventory/gudang")) {
      return {
        data: { gudangs: [] as unknown[] },
        isLoading: false,
        error: null,
        mutate: vi.fn().mockResolvedValue(undefined),
      };
    }
    return {
      data: undefined,
      isLoading: false,
      error: null,
      mutate: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    type = "button",
    disabled,
    onClick,
  }: {
    children?: React.ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/inventory/PhotoUpload", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    PhotoUpload: actual.forwardRef(() => null),
  };
});

import { TransferForm } from "@/components/inventory/TransferForm";

describe("TransferForm stock caption", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseEffect.mockClear();
    mockUseState.mockImplementation((initialValue: unknown) => {
      // Order useState di TransferForm setelah migrasi ke useApi:
      // 1. formData
      // 2. stockSumber
      // 3. stockPerKondisi
      // 4. stockGudangSumber
      // 5. error
      // 6. success
      // 7. _uploadedPhotos
      // 8. transactionId
      // 9. tempId
      switch (mockUseState.mock.calls.length) {
        case 1:
          return [
            {
              barangId: "barang-1",
              dariGudangId: "gudang-1",
              keGudangId: "gudang-2",
              jumlah: "",
              kondisi: "BARU",
              keterangan: "",
            },
            vi.fn(),
          ];
        case 2:
          return [7, vi.fn()];
        case 3:
          return [
            {
              BARU: 7,
              BEKAS: 0,
              RUSAK: 0,
            },
            vi.fn(),
          ];
        case 4:
          return [
            {
              id: "gudang-1",
              kode: "GD-001",
              nama: "Gudang Pusat",
            },
            vi.fn(),
          ];
        case 5:
          return ["", vi.fn()]; // error
        case 6:
          return ["", vi.fn()]; // success
        case 7:
          return [[], vi.fn()]; // _uploadedPhotos
        case 8:
          return [null, vi.fn()]; // transactionId
        case 9:
          return ["temp-id", vi.fn()]; // tempId
        default:
          return [initialValue, vi.fn()];
      }
    });
  });

  it("tetap menampilkan label stok saat daftar gudang tidak memuat gudang sumber terpilih", () => {
    const markup = renderToStaticMarkup(<TransferForm onClose={vi.fn()} />);

    expect(markup).toContain("Stok tersedia di Gudang Pusat:");
    expect(markup).toContain("7 pcs");
  });
});
