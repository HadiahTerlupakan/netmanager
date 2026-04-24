import { beforeEach, describe, expect, it, vi } from "vitest";

const realtimeContextMocks = vi.hoisted(() => {
  const effectCleanups: Array<() => void> = [];
  const dynamicScopesState = {
    value: [] as Array<{ kind: string; id: string }>,
  };
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
  const signInWithCustomTokenMock = vi.fn().mockResolvedValue(undefined);
  const signOutMock = vi.fn().mockResolvedValue(undefined);
  const fetchMock = vi.fn();
  const authMock = {
    currentUser: null as { uid: string } | null,
  };
  const getRealtimeClientServicesMock = vi.fn(() => ({
    firebaseApp: { name: "client-app" },
    auth: authMock,
    firestore: { kind: "firestore" },
    realtimeDatabase: { kind: "database" },
  }));

  return {
    effectCleanups,
    dynamicScopesState,
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
    signInWithCustomTokenMock,
    signOutMock,
    fetchMock,
    authMock,
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

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: realtimeContextMocks.signInWithCustomTokenMock,
  signOut: realtimeContextMocks.signOutMock,
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

type TestRealtimeUser = {
  id?: string;
  role?: string;
  departmentId?: string | null;
  tenantId?: string | null;
  siteId?: string | null;
  primarySiteId?: string | null;
  siteIds?: string[] | null;
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isSuperAdmin?: boolean;
};

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
    realtimeContextMocks.signInWithCustomTokenMock.mockClear();
    realtimeContextMocks.signOutMock.mockClear();
    realtimeContextMocks.fetchMock.mockReset();
    realtimeContextMocks.authMock.currentUser = null;
    realtimeContextMocks.getRealtimeClientServicesMock.mockClear();

    realtimeContextMocks.dynamicScopesState.value = [];
    realtimeContextMocks.mockUseState.mockImplementation(
      (initialValue: unknown) => {
        if (Array.isArray(initialValue)) {
          const setDynamicScopes = vi.fn(
            (
              value:
                | Array<{ kind: string; id: string }>
                | ((
                    previous: Array<{ kind: string; id: string }>,
                  ) => Array<{ kind: string; id: string }>),
            ) => {
              realtimeContextMocks.dynamicScopesState.value =
                typeof value === "function"
                  ? value(realtimeContextMocks.dynamicScopesState.value)
                  : value;
            },
          );

          return [
            realtimeContextMocks.dynamicScopesState.value,
            setDynamicScopes,
          ];
        }

        if (initialValue === false) {
          return [true, vi.fn()];
        }

        return [initialValue, vi.fn()];
      },
    );

    realtimeContextMocks.fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: "firebase-custom-token" }),
    });
    vi.stubGlobal("fetch", realtimeContextMocks.fetchMock);

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
      } satisfies TestRealtimeUser,
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

  it("uses only the site-scoped admin notification stream for site admins", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    const element = RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "user-1",
        role: "ADMIN",
        isSuperAdmin: false,
        accessAdminPanel: true,
        siteId: "site-1",
      } satisfies TestRealtimeUser,
    });

    const scopes = (
      element as {
        props: {
          value: {
            scopes: Array<{ kind: string; id: string }>;
          };
        };
      }
    ).props.value.scopes;

    expect(scopes).toEqual(
      expect.arrayContaining([
        { kind: "user", id: "user-1" },
        { kind: "admin", id: "notifications.site.site-1" },
      ]),
    );
    expect(scopes).not.toContainEqual({
      kind: "admin",
      id: "notifications",
    });
  });

  it("does not subscribe non-super-admins to generic admin notifications when no site is available", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    const element = RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "user-2",
        role: "ADMIN",
        isSuperAdmin: false,
        accessAdminPanel: true,
      } satisfies TestRealtimeUser,
    });

    const scopes = (
      element as {
        props: {
          value: {
            scopes: Array<{ kind: string; id: string }>;
          };
        };
      }
    ).props.value.scopes;

    expect(scopes).toContainEqual({ kind: "user", id: "user-2" });
    expect(scopes).not.toContainEqual({
      kind: "admin",
      id: "notifications",
    });
  });

  it("allows super admins without site scope to use the generic admin notifications stream", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    const element = RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "super-admin-1",
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        accessAdminPanel: true,
      } satisfies TestRealtimeUser,
    });

    const scopes = (
      element as {
        props: {
          value: {
            scopes: Array<{ kind: string; id: string }>;
          };
        };
      }
    ).props.value.scopes;

    expect(scopes).toContainEqual({ kind: "user", id: "super-admin-1" });
    expect(scopes).toContainEqual({
      kind: "admin",
      id: "notifications",
    });
  });

  it("does not assign admin notification scopes to employee-only users", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    const element = RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "employee-1",
        role: "EMPLOYEE",
        accessAdminPanel: false,
        accessEmployeePanel: true,
      } satisfies TestRealtimeUser,
    });

    const scopes = (
      element as {
        props: {
          value: {
            scopes: Array<{ kind: string; id: string }>;
          };
        };
      }
    ).props.value.scopes;

    expect(scopes).toEqual([{ kind: "user", id: "employee-1" }]);
    expect(scopes.some((scope) => scope.kind === "admin")).toBe(false);
  });

  it("does not include department scope in default admin subscriptions", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    const element = RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "admin-1",
        role: "ADMIN",
        departmentId: "department-1",
        accessAdminPanel: true,
        accessEmployeePanel: true,
        siteId: "site-1",
      } satisfies TestRealtimeUser,
    });

    const scopes = (
      element as {
        props: {
          value: {
            scopes: Array<{ kind: string; id: string }>;
          };
        };
      }
    ).props.value.scopes;

    expect(scopes).toContainEqual({ kind: "user", id: "admin-1" });
    expect(scopes).toContainEqual({
      kind: "admin",
      id: "notifications.site.site-1",
    });
    expect(scopes).not.toContainEqual({
      kind: "department",
      id: "department-1",
    });
  });

  it("re-authenticates Firebase when the authenticated session switches to another user", async () => {
    const { RealtimeProvider } = await import("@/lib/realtime/RealtimeContext");

    realtimeContextMocks.authMock.currentUser = { uid: "user-1" };

    RealtimeProvider({
      children: null,
      statusOverride: "authenticated",
      userOverride: {
        id: "user-2",
        role: "ADMIN",
        accessAdminPanel: true,
        siteId: "site-2",
      } satisfies TestRealtimeUser,
    });

    expect(realtimeContextMocks.signOutMock).toHaveBeenCalledTimes(1);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (
        realtimeContextMocks.signInWithCustomTokenMock.mock.calls.length > 0
      ) {
        break;
      }
      await Promise.resolve();
    }

    expect(realtimeContextMocks.fetchMock).toHaveBeenCalledWith(
      "/api/auth/firebase-token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(realtimeContextMocks.signInWithCustomTokenMock).toHaveBeenCalledWith(
      realtimeContextMocks.authMock,
      "firebase-custom-token",
    );
  });
});
