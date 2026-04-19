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

    let stateCallIndex = 0;
    mockUseState.mockImplementation((initialValue: unknown) => {
      stateCallIndex += 1;

      if (stateCallIndex === 11) {
        return ["gudang-a", vi.fn()];
      }

      if (stateCallIndex === 13) {
        return [[{ barangId: "barang-1", quantity: 1 }], vi.fn()];
      }

      if (stateCallIndex === 19) {
        return [true, vi.fn()];
      }

      return [initialValue, vi.fn()];
    });
  });

  it("does not submit request again while a submission is already in progress", async () => {
    const hook = useRestockPage();

    await hook.saveRequest();

    expect(mockPostWithAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Harap lengkapi data barang dan gudang",
    );
  });
});
