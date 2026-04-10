import { beforeEach, describe, expect, it, vi } from "vitest";

const refMock = vi.fn((...args: unknown[]) => {
  const [, path] = args;
  return { path };
});
const getDatabaseMock = vi.fn(() => ({ kind: "database" }));
const useSocketMock = vi.fn();

const mockRealtimeClientServices = {
  firebaseApp: { name: "shared-app" },
  firestore: null as null,
  realtimeDatabase: { kind: "database" },
};

const onValueMock = vi.fn((...args: unknown[]) => {
  const callback = args[1];
  presenceSnapshotHandler = callback as typeof presenceSnapshotHandler;
  lastUnsubscribe = vi.fn();
  return lastUnsubscribe;
});

let presenceSnapshotHandler:
  | ((snapshot: {
      exists: () => boolean;
      val: () => Record<string, unknown> | null;
    }) => void)
  | null = null;
let onlineUsersState = new Set<string>();
let useCallbackResults = new Map<string, (...args: unknown[]) => unknown>();
let lastEffectDeps: unknown[] | undefined;
let lastEffectCleanup: (() => void) | undefined;
let lastUnsubscribe: ReturnType<typeof vi.fn> | null = null;

const mockUseState = vi.fn((initialValue: unknown) => {
  if (onlineUsersState.size === 0 && initialValue instanceof Set) {
    onlineUsersState = new Set(initialValue as Set<string>);
  }

  const setState = vi.fn((nextValue: unknown) => {
    if (typeof nextValue === "function") {
      onlineUsersState = (nextValue as (previous: Set<string>) => Set<string>)(
        onlineUsersState,
      );
      return;
    }

    if (nextValue instanceof Set) {
      onlineUsersState = nextValue;
      return;
    }

    onlineUsersState = new Set(Array.isArray(nextValue) ? nextValue : []);
  });

  return [onlineUsersState, setState];
});

const mockUseEffect = vi.fn(
  (effect: () => void | (() => void), deps?: unknown[]) => {
    const depsKey = JSON.stringify(deps ?? []);
    const lastDepsKey = JSON.stringify(lastEffectDeps ?? []);

    if (lastEffectDeps && depsKey === lastDepsKey) {
      return;
    }

    if (lastEffectCleanup) {
      lastEffectCleanup();
      lastEffectCleanup = undefined;
    }

    lastEffectDeps = deps;
    const cleanup = effect();
    if (typeof cleanup === "function") {
      lastEffectCleanup = cleanup;
    }
  },
);

const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, deps?: unknown[]) => {
    const key = JSON.stringify(deps ?? []);
    const existing = useCallbackResults.get(key);
    if (existing) return existing;
    useCallbackResults.set(key, fn);
    return fn;
  },
);

const mockUseMemo = vi.fn((factory: () => unknown, _deps?: unknown[]) =>
  factory(),
);
const mockUseRef = vi.fn((value: unknown) => ({ current: value }));
const mockUseSocketEvent = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: (...args: unknown[]) => mockUseState(...(args as [unknown])),
    useEffect: (...args: unknown[]) =>
      mockUseEffect(...(args as [() => void | (() => void), unknown[]?])),
    // preserve deps at call site by forwarding both effect and dependency array
    useCallback: (...args: unknown[]) =>
      mockUseCallback(
        ...(args as [(...input: unknown[]) => unknown, unknown[]?]),
      ),
    useMemo: (...args: unknown[]) =>
      mockUseMemo(...(args as [() => unknown, unknown[]?])),
    useRef: (...args: unknown[]) => mockUseRef(...(args as [unknown])),
  };
});

vi.mock("@/lib/websocket/SocketContext", () => ({
  useSocket: () => useSocketMock(),
  useSocketEvent: mockUseSocketEvent,
}));

vi.mock("@/lib/realtime/client", () => ({
  getRealtimeClientServices: () => mockRealtimeClientServices,
}));

vi.mock("firebase/database", () => ({
  getDatabase: getDatabaseMock,
  ref: refMock,
  onValue: onValueMock,
}));

describe("usePresence", () => {
  beforeEach(() => {
    vi.resetModules();
    refMock.mockClear();
    getDatabaseMock.mockClear();
    onValueMock.mockClear();
    useSocketMock.mockReset();
    mockUseState.mockClear();
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
    mockUseMemo.mockClear();
    mockUseRef.mockClear();
    mockUseSocketEvent.mockClear();
    mockRealtimeClientServices.realtimeDatabase = { kind: "database" };
    presenceSnapshotHandler = null;
    onlineUsersState = new Set();
    useCallbackResults = new Map();
    lastEffectDeps = undefined;
    lastEffectCleanup = undefined;
    lastUnsubscribe = null;
  });

  it("reads the global presence/users path and returns an empty list when the snapshot is empty", async () => {
    useSocketMock.mockReturnValue({
      socket: { emit: vi.fn() },
      isConnected: true,
    });

    const { usePresence } = await import("@/lib/realtime/hooks/usePresence");

    const firstRender = usePresence();
    expect(refMock).toHaveBeenCalledWith(
      { kind: "database" },
      "presence/users",
    );
    expect(typeof presenceSnapshotHandler).toBe("function");

    presenceSnapshotHandler?.({
      exists: () => false,
      val: () => null,
    });

    const secondRender = usePresence();

    expect(lastUnsubscribe).toBeTypeOf("function");

    mockRealtimeClientServices.realtimeDatabase = null;
    const thirdRender = usePresence();

    expect(lastUnsubscribe).toHaveBeenCalledTimes(1);
    expect(thirdRender.onlineUserIds).toEqual([]);

    expect(firstRender.isConnected).toBe(true);
    expect(secondRender.isConnected).toBe(true);
    expect(secondRender.onlineUserIds).toEqual([]);
    expect(secondRender.refreshPresence).toBe(firstRender.refreshPresence);
    expect(mockUseSocketEvent).not.toHaveBeenCalled();
    expect(mockUseCallback).toHaveBeenCalledWith(expect.any(Function), []);
  });

  it("extracts online user ids from the RTDB snapshot while preserving provider connectivity", async () => {
    useSocketMock.mockReturnValue({
      socket: { emit: vi.fn() },
      isConnected: false,
    });

    const { usePresence } = await import("@/lib/realtime/hooks/usePresence");

    usePresence();

    presenceSnapshotHandler?.({
      exists: () => true,
      val: () => ({
        "user-1": {
          userId: "user-1",
          isOnline: true,
          source: "web",
          updatedAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T00:00:00.000Z",
        },
        "user-2": {
          userId: "user-2",
          isOnline: true,
          source: "mobile",
          updatedAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T00:00:00.000Z",
        },
      }),
    });

    const rerender = usePresence();

    expect(rerender.isConnected).toBe(false);
    expect(rerender.onlineUserIds).toEqual(["user-1", "user-2"]);
    expect(rerender.refreshPresence).toBeTypeOf("function");
    expect(mockUseSocketEvent).not.toHaveBeenCalled();
    expect(mockUseCallback).toHaveBeenCalledWith(expect.any(Function), []);
  });

  it("subscribes after the RTDB client becomes available on a later render", async () => {
    useSocketMock.mockReturnValue({
      socket: { emit: vi.fn() },
      isConnected: true,
    });
    mockRealtimeClientServices.realtimeDatabase = null;

    const { usePresence } = await import("@/lib/realtime/hooks/usePresence");

    const firstRender = usePresence();

    expect(firstRender.onlineUserIds).toEqual([]);
    expect(onValueMock).not.toHaveBeenCalled();

    mockRealtimeClientServices.realtimeDatabase = { kind: "database" };

    const secondRender = usePresence();

    expect(refMock).toHaveBeenCalledWith(
      { kind: "database" },
      "presence/users",
    );
    expect(onValueMock).toHaveBeenCalledTimes(1);
    expect(typeof presenceSnapshotHandler).toBe("function");
    expect(secondRender.onlineUserIds).toEqual([]);
  });

  it("cleans up the RTDB presence listener when the database dependency changes", async () => {
    useSocketMock.mockReturnValue({
      socket: { emit: vi.fn() },
      isConnected: true,
    });
    mockRealtimeClientServices.realtimeDatabase = { kind: "database" };

    const { usePresence } = await import("@/lib/realtime/hooks/usePresence");

    usePresence();

    expect(onValueMock).toHaveBeenCalledTimes(1);
    expect(lastUnsubscribe).toBeTypeOf("function");

    mockRealtimeClientServices.realtimeDatabase = null;

    usePresence();

    expect(lastUnsubscribe).toHaveBeenCalledTimes(1);
    expect(onValueMock).toHaveBeenCalledTimes(1);
  });
});
