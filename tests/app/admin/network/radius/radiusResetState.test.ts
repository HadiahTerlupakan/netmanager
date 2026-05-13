import { beforeEach, describe, expect, it, vi } from "vitest";

let currentState: {
  resettingUsername: string | null;
  deletingUsername: string | null;
  actionError: string | null;
  actionSuccess: string | null;
};

const mockUseState = vi.fn();
const mockUseCallback = vi.fn((fn: unknown) => fn);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    useCallback: ((fn: unknown) =>
      mockUseCallback(fn)) as typeof actual.useCallback,
  };
});

import { useRadiusResetState } from "@/app/admin/network/radius/lib/radiusResetState";

describe("useRadiusResetState", () => {
  beforeEach(() => {
    currentState = {
      resettingUsername: null,
      deletingUsername: null,
      actionError: null,
      actionSuccess: null,
    };
    mockUseState.mockImplementation((initialState: typeof currentState) => {
      currentState = initialState;
      const setState = vi.fn(
        (
          nextValue:
            | typeof currentState
            | ((previousState: typeof currentState) => typeof currentState),
        ) => {
          currentState =
            typeof nextValue === "function"
              ? (
                  nextValue as (
                    previousState: typeof currentState,
                  ) => typeof currentState
                )(currentState)
              : nextValue;
        },
      );

      return [currentState, setState];
    });
    mockUseCallback.mockClear();
  });

  it("menahan actionSuccess sampai refresh dashboard selesai", async () => {
    const refreshDeferred = createDeferred<void>();
    const resetConnection = vi.fn().mockResolvedValue({
      username: "alice",
      disconnected: 2,
    });
    const refreshDashboard = vi.fn(() => refreshDeferred.promise);

    const hook = useRadiusResetState({
      resetConnection,
      forceDeleteUser: vi.fn(),
      refreshDashboard,
    });
    const actionPromise = hook.resetConnection("alice");

    await Promise.resolve();

    expect(resetConnection).toHaveBeenCalledWith("alice");
    expect(refreshDashboard).toHaveBeenCalledTimes(1);
    expect(currentState.actionSuccess).toBeNull();
    expect(currentState.resettingUsername).toBe("alice");

    refreshDeferred.resolve();
    await actionPromise;

    expect(currentState.actionSuccess).toBe(
      "Reset koneksi alice berhasil (2 sesi diputus)",
    );
    expect(currentState.actionError).toBeNull();
    expect(currentState.resettingUsername).toBeNull();
  });

  it("tidak menampilkan actionSuccess jika refresh dashboard gagal", async () => {
    const resetConnection = vi.fn().mockResolvedValue({
      username: "alice",
      disconnected: 2,
    });
    const refreshDashboard = vi
      .fn()
      .mockRejectedValue(new Error("refresh failed"));

    const hook = useRadiusResetState({
      resetConnection,
      forceDeleteUser: vi.fn(),
      refreshDashboard,
    });
    await hook.resetConnection("alice");

    expect(currentState.actionSuccess).toBeNull();
    expect(currentState.actionError).toBe("refresh failed");
    expect(currentState.resettingUsername).toBeNull();
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
