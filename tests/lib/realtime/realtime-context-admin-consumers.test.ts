import { beforeEach, describe, expect, it, vi } from "vitest";

const realtimeContextMocks = vi.hoisted(() => {
  const effectCleanups: Array<() => void> = [];
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === "function") {
      effectCleanups.push(cleanup);
    }
  });
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseCallback = vi.fn(
    (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
  );
  const mockUseRef = vi.fn((value: unknown) => ({ current: value }));
  const mockUseState = vi.fn();
  const mockUseSession = vi.fn();
  const refMock = vi.fn((_database: unknown, path: string) => ({ path }));
  const setMock = vi.fn().mockResolvedValue(undefined);
  const onDisconnectSetMock = vi.fn().mockResolvedValue(undefined);
  const onDisconnectRemoveMock = vi.fn().mockResolvedValue(undefined);
  const onDisconnectMock = vi.fn(() => ({
    set: onDisconnectSetMock,
    remove: onDisconnectRemoveMock,
  }));
  const getRealtimeClientServicesMock = vi.fn(() => ({
    firebaseApp: { name: "client-app" },
    firestore: { kind: "firestore" },
    realtimeDatabase: { kind: "database" },
  }));

  return {
    effectCleanups,
    mockUseEffect,
    mockUseMemo,
    mockUseCallback,
    mockUseRef,
    mockUseState,
    mockUseSession,
    refMock,
    setMock,
    onDisconnectSetMock,
    onDisconnectRemoveMock,
    onDisconnectMock,
    getRealtimeClientServicesMock,
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: realtimeContextMocks.mockUseEffect,
    useMemo: realtimeContextMocks.mockUseMemo,
    useCallback: realtimeContextMocks.mockUseCallback,
    useRef: realtimeContextMocks.mockUseRef,
    useState: <T>(initialValue: T) =>
      realtimeContextMocks.mockUseState(initialValue) as [
        T,
        (value: T | ((previous: T) => T)) => void,
      ],
  };
});

vi.mock("next-auth/react", () => ({
  useSession: () => realtimeContextMocks.mockUseSession(),
}));

vi.mock("firebase/database", () => ({
  ref: realtimeContextMocks.refMock,
  set: realtimeContextMocks.setMock,
  onDisconnect: realtimeContextMocks.onDisconnectMock,
}));

vi.mock("@/lib/realtime/client", () => ({
  getRealtimeClientServices: () =>
    realtimeContextMocks.getRealtimeClientServicesMock(),
}));

describe("RealtimeProvider admin consumer writes", () => {
  beforeEach(() => {
    vi.resetModules();
    realtimeContextMocks.effectCleanups.splice(0);
    realtimeContextMocks.mockUseEffect.mockClear();
    realtimeContextMocks.mockUseMemo.mockClear();
    realtimeContextMocks.mockUseCallback.mockClear();
    realtimeContextMocks.mockUseRef.mockClear();
    realtimeContextMocks.mockUseState.mockReset();
    realtimeContextMocks.mockUseSession.mockReset();
    realtimeContextMocks.refMock.mockClear();
    realtimeContextMocks.setMock.mockClear();
    realtimeContextMocks.onDisconnectSetMock.mockClear();
    realtimeContextMocks.onDisconnectRemoveMock.mockClear();
    realtimeContextMocks.onDisconnectMock.mockClear();
    realtimeContextMocks.getRealtimeClientServicesMock.mockClear();

    realtimeContextMocks.mockUseState.mockImplementation(
      (initialValue: unknown) => {
        if (Array.isArray(initialValue)) {
          return [[{ kind: "admin", id: "mikrotik" }], vi.fn()];
        }

        if (initialValue === false) {
          return [true, vi.fn()];
        }

        return [initialValue, vi.fn()];
      },
    );

    realtimeContextMocks.mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          accessAdminPanel: true,
        },
      },
      status: "authenticated",
    });
  });

  it("does not write admin scope consumer records from the browser client", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "user-1",
        accessAdminPanel: true,
      },
    });

    const writtenPaths = realtimeContextMocks.setMock.mock.calls.flatMap(
      (args) => {
        const reference = args.at(0);
        return reference ? [(reference as { path: string }).path] : [];
      },
    );
    const onDisconnectPaths =
      realtimeContextMocks.onDisconnectMock.mock.calls.flatMap((args) => {
        const reference = args.at(0);
        return reference ? [(reference as { path: string }).path] : [];
      });

    expect(writtenPaths).toContain("presence/users/user-1");
    expect(onDisconnectPaths).toContain("presence/users/user-1");
    expect(writtenPaths).not.toContain(
      "presence/scopes/admin%3Amikrotik/consumers/user-1",
    );
    expect(onDisconnectPaths).not.toContain(
      "presence/scopes/admin%3Amikrotik/consumers/user-1",
    );
  });
});
