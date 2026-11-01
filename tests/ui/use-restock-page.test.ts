import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseState = vi.fn();
const mockUseCallback = vi.fn((fn: unknown) => fn);
const mockUseEffect = vi.fn();
const mockUseMemo = vi.fn((factory: unknown) => (factory as () => unknown)());
const mockUseRef = vi.fn((value: unknown) => ({ current: value }));

const mockGetWithAuth = vi.fn();
const mockPostWithAuth = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastLoading = vi.fn();
const mockToastDismiss = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    useCallback: ((fn: unknown) =>
      mockUseCallback(fn)) as typeof actual.useCallback,
    useEffect: ((effect: unknown) =>
      mockUseEffect(effect)) as typeof actual.useEffect,
    useMemo: ((factory: unknown) =>
      mockUseMemo(factory)) as typeof actual.useMemo,
    useRef: ((value: unknown) => mockUseRef(value)) as typeof actual.useRef,
  };
});

vi.mock("@/lib/api-client", () => ({
  getWithAuth: (...args: unknown[]) => mockGetWithAuth(...args),
  postWithAuth: (...args: unknown[]) => mockPostWithAuth(...args),
  patchWithAuth: vi.fn(),
  putWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    loading: (...args: unknown[]) => mockToastLoading(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
  },
}));

import { useRestockPage } from "@/app/admin/inventory/restock/useRestockPage";

describe("useRestockPage", () => {
  beforeEach(() => {
    mockUseCallback.mockClear();
    mockUseEffect.mockClear();
    mockUseMemo.mockClear();
    mockUseRef.mockClear();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    mockToastLoading.mockClear();
    mockToastDismiss.mockClear();
    mockGetWithAuth.mockReset();
    mockPostWithAuth.mockReset();

    mockGetWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    mockPostWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    useStateOverrides(new Map());
  });

  /**
   * Isi `useState` menurut urutan pemanggilannya di hook. Urutan ini harus
   * mengikuti `useRestockPage`; versi lama memakai nomor yang sudah basi
   * sehingga test "sedang menyimpan" sebenarnya menguji form kosong.
   */
  function useStateOverrides(overrides: Map<number, unknown>) {
    let stateCallIndex = 0;
    mockUseState.mockImplementation((initialValue: unknown) => {
      stateCallIndex += 1;
      const value = overrides.has(stateCallIndex)
        ? overrides.get(stateCallIndex)
        : initialValue;
      return [value, vi.fn()];
    });
  }

  const STATE_FORM_GUDANG = 15;
  const STATE_FORM_NOTES = 16;
  const STATE_FORM_ITEMS = 17;
  const STATE_SUBMITTING = 25;

  it("does not submit request again while a submission is already in progress", async () => {
    useStateOverrides(
      new Map<number, unknown>([
        [STATE_FORM_GUDANG, "gudang-a"],
        [STATE_FORM_NOTES, "Restock ODP"],
        [
          STATE_FORM_ITEMS,
          [{ tipe: "BARANG", barangId: "barang-1", quantity: 1 }],
        ],
        [STATE_SUBMITTING, true],
      ]),
    );
    const hook = useRestockPage();

    await hook.saveRequest();

    expect(mockPostWithAuth).not.toHaveBeenCalled();
    // Klik kedua saat penyimpanan berjalan diabaikan; dulu ia memunculkan
    // "Harap lengkapi data" padahal datanya sudah lengkap.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("lists every missing part of an incomplete form", async () => {
    const hook = useRestockPage();

    await hook.saveRequest();

    expect(mockPostWithAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      [
        "Pengajuan belum bisa disimpan:",
        "Gudang tujuan belum dipilih.",
        "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
        "Baris ke-1: barangnya belum dipilih.",
      ].join("\n"),
      expect.objectContaining({ duration: 10_000 }),
    );
  });
});
