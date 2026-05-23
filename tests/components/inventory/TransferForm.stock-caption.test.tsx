import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <T,>(initialValue: T): UseStateTuple<T> =>
      mockUseState(initialValue) as UseStateTuple<T>,
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

vi.mock("@/lib/hooks/useInvalidate", () => ({
  useInvalidateInventoryRelated: () => vi.fn(),
}));

const SELECTED_GUDANG = {
  id: "gudang-1",
  kode: "GD-001",
  nama: "Gudang Pusat",
  lokasi: "Jakarta",
};

vi.mock("@/components/inventory/form-shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/inventory/form-shared")
  >("@/components/inventory/form-shared");

  return {
    ...actual,
    useGudangOptions: () => ({
      gudangs: [SELECTED_GUDANG],
      isLoading: false,
    }),
    useBarangOptions: () => ({
      isSearching: false,
      fetchBarangs: vi.fn(),
      findBarang: (id: string) =>
        id === "barang-1"
          ? {
              id: "barang-1",
              kode: "BRG-001",
              nama: "Modem",
              satuan: "pcs",
            }
          : undefined,
      buildOptions: () => [{ value: "barang-1", label: "BRG-001 - Modem" }],
    }),
    useFotoBuktiUpload: () => ({
      photoUploadRef: { current: null as unknown },
      tempId: "temp-id",
      setUploadedPhotos: vi.fn(),
      uploadPendingPhotos: vi.fn().mockResolvedValue({ urls: [], photos: [] }),
      buildFotoMetadata: vi.fn().mockReturnValue([]),
      resetFotoState: vi.fn(),
    }),
    useStockByCondition: () => ({
      BARU: 7,
      BEKAS: 0,
      RUSAK: 0,
      totalStok: 7,
    }),
    FotoBuktiSection: (() => {
      const Component = (): null => null;
      Component.displayName = "FotoBuktiSection";
      return Component;
    })(),
  };
});

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

import { TransferForm } from "@/components/inventory/TransferForm";

describe("TransferForm stock caption", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseState.mockImplementation((initialValue: unknown) => {
      // Urutan useState di TransferForm setelah refactor:
      // 1. formData
      // 2. error
      // 3. success
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
          return ["", vi.fn()]; // error
        case 3:
          return ["", vi.fn()]; // success
        default:
          return [initialValue, vi.fn()];
      }
    });
  });

  it("tetap menampilkan label stok saat daftar gudang sumber tersedia", () => {
    const markup = renderToStaticMarkup(<TransferForm onClose={vi.fn()} />);

    expect(markup).toContain("Stok tersedia di Gudang Pusat:");
    expect(markup).toContain("7 pcs");
  });
});
