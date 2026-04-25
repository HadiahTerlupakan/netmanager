import { beforeEach, describe, expect, it, vi } from "vitest";

const realtimeSubscriptionMocks = vi.hoisted(() => {
  const mockUseContext = vi.fn();
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => effect());
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseRef = vi.fn((value: unknown) => ({ current: value }));
  const collectionMock = vi.fn((_firestore: unknown, path: string) => ({
    path,
  }));
  const orderByMock = vi.fn((field: string, direction: string) => ({
    type: "orderBy",
    field,
    direction,
  }));
  const limitMock = vi.fn((value: number) => ({ type: "limit", value }));
  const queryMock = vi.fn((target: unknown, ...constraints: unknown[]) => ({
    target,
    constraints,
  }));
  const onSnapshotMock = vi.fn();

  return {
    mockUseContext,
    mockUseEffect,
    mockUseMemo,
    mockUseRef,
    collectionMock,
    orderByMock,
    limitMock,
    queryMock,
    onSnapshotMock,
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useContext: realtimeSubscriptionMocks.mockUseContext,
    useEffect: realtimeSubscriptionMocks.mockUseEffect,
    useMemo: realtimeSubscriptionMocks.mockUseMemo,
    useRef: realtimeSubscriptionMocks.mockUseRef,
  };
});

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ status: "unauthenticated", data: null })),
}));

vi.mock("firebase/database", () => ({
  onDisconnect: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: realtimeSubscriptionMocks.collectionMock,
  limit: realtimeSubscriptionMocks.limitMock,
  onSnapshot: realtimeSubscriptionMocks.onSnapshotMock,
  orderBy: realtimeSubscriptionMocks.orderByMock,
  query: realtimeSubscriptionMocks.queryMock,
}));

vi.mock("@/lib/realtime/client", () => ({
  getRealtimeClientServices: vi.fn(() => ({
    auth: null,
    firebaseApp: null,
    firestore: null,
    realtimeDatabase: null,
  })),
}));

describe("useRealtimeSubscription error diagnostics", () => {
  const consoleErrorMock = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.resetModules();
    realtimeSubscriptionMocks.mockUseContext.mockReset();
    realtimeSubscriptionMocks.mockUseEffect.mockClear();
    realtimeSubscriptionMocks.mockUseMemo.mockClear();
    realtimeSubscriptionMocks.mockUseRef.mockClear();
    realtimeSubscriptionMocks.collectionMock.mockClear();
    realtimeSubscriptionMocks.orderByMock.mockClear();
    realtimeSubscriptionMocks.limitMock.mockClear();
    realtimeSubscriptionMocks.queryMock.mockClear();
    realtimeSubscriptionMocks.onSnapshotMock.mockReset();
    consoleErrorMock.mockClear();

    realtimeSubscriptionMocks.mockUseContext.mockReturnValue({
      firestore: { kind: "firestore" },
      isConnected: true,
      scopes: [{ kind: "admin", id: "mikrotik" }],
    });
  });

  it("logs scope and channel when Firestore subscription fails", async () => {
    realtimeSubscriptionMocks.onSnapshotMock.mockImplementation(
      (_query, _next, errorHandler) => {
        errorHandler({
          code: "permission-denied",
          message: "Missing or insufficient permissions.",
        });

        return vi.fn();
      },
    );

    const { useRealtimeSubscription } =
      await import("@/lib/realtime/RealtimeContext");

    useRealtimeSubscription("mikrotik.update", vi.fn());

    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Realtime Firestore subscription failed",
      {
        scope: "admin:mikrotik",
        channel: "admins/mikrotik/events",
        event: "mikrotik.update",
        message: "Missing or insufficient permissions.",
        code: "permission-denied",
      },
    );
  });

  it("does not subscribe notification events to workorder detail scopes", async () => {
    realtimeSubscriptionMocks.mockUseContext.mockReturnValue({
      firestore: { kind: "firestore" },
      isConnected: true,
      scopes: [
        { kind: "user", id: "user-1" },
        { kind: "workorder", id: "wo-1" },
      ],
    });

    realtimeSubscriptionMocks.onSnapshotMock.mockReturnValue(vi.fn());

    const { useRealtimeSubscription } =
      await import("@/lib/realtime/RealtimeContext");

    useRealtimeSubscription("notification.new", vi.fn());

    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledTimes(1);
    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledWith(
      { kind: "firestore" },
      "users/user-1/events",
    );
  });

  it("does not subscribe workorder events to unreadable workorder detail scopes", async () => {
    realtimeSubscriptionMocks.mockUseContext.mockReturnValue({
      firestore: { kind: "firestore" },
      isConnected: true,
      scopes: [
        { kind: "admin", id: "workorders.site.site-1" },
        { kind: "workorder", id: "wo-1" },
      ],
    });

    realtimeSubscriptionMocks.onSnapshotMock.mockReturnValue(vi.fn());

    const { useRealtimeSubscription } =
      await import("@/lib/realtime/RealtimeContext");

    useRealtimeSubscription("workorder.update", vi.fn());

    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledTimes(1);
    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledWith(
      { kind: "firestore" },
      "admins/workorders.site.site-1/events",
    );
  });

  it("subscribes legacy ticket events to ticket detail scopes", async () => {
    realtimeSubscriptionMocks.mockUseContext.mockReturnValue({
      firestore: { kind: "firestore" },
      isConnected: true,
      scopes: [{ kind: "ticket", id: "ticket-1" }],
    });

    realtimeSubscriptionMocks.onSnapshotMock.mockReturnValue(vi.fn());

    const { useRealtimeSubscription } =
      await import("@/lib/realtime/RealtimeContext");

    useRealtimeSubscription("ticket:update", vi.fn());

    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledTimes(1);
    expect(realtimeSubscriptionMocks.collectionMock).toHaveBeenCalledWith(
      { kind: "firestore" },
      "tickets/ticket-1/events",
    );
  });
});
