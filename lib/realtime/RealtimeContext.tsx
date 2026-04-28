"use client";
import { clientLogger } from "@/lib/client-logger";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { useSession } from "next-auth/react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { onDisconnect, ref, set } from "firebase/database";

import {
  LEGACY_TO_REALTIME_EVENT,
  buildPresencePath,
  buildScopeChannel,
  getEventSubscriptionNames,
} from "@/lib/realtime/channel-map";
import { getRealtimeClientServices } from "@/lib/realtime/client";
import type {
  PresenceSnapshot,
  RealtimeEnvelope,
  RealtimeScope,
} from "@/lib/realtime/contracts";

type TransportSource = {
  emit?: (...args: unknown[]) => unknown;
  on?: (...args: unknown[]) => unknown;
  off?: (...args: unknown[]) => unknown;
};

type SessionUser = {
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

export interface RealtimeTransport {
  emit: (...args: unknown[]) => void;
  on: (...args: unknown[]) => void;
  off: (...args: unknown[]) => void;
}

export interface RealtimeConnectionState {
  socket: null;
  transport: RealtimeTransport | null;
  isConnected: boolean;
  lastError: string | null;
  reconnect: () => void;
  subscribeScope?: (scope: RealtimeScope) => () => void;
}

interface RealtimeContextValue extends RealtimeConnectionState {
  firestore: ReturnType<typeof getRealtimeClientServices>["firestore"];
  scopes: RealtimeScope[];
}

type FirebaseTokenResponse = {
  token?: string;
  error?: string;
};

function noop(): void {}

export function createRealtimeTransport(
  source?: TransportSource,
): RealtimeTransport {
  return {
    emit: (...args: unknown[]) => {
      source?.emit?.(...args);
    },
    on: (...args: unknown[]) => {
      source?.on?.(...args);
    },
    off: (...args: unknown[]) => {
      source?.off?.(...args);
    },
  };
}

const DEFAULT_TRANSPORT = createRealtimeTransport();
const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
  userOverride?: SessionUser | null;
  statusOverride?: "authenticated" | "unauthenticated" | "loading";
}

function resolveAuthStatus(
  sessionStatus: "authenticated" | "unauthenticated" | "loading",
  statusOverride?: "authenticated" | "unauthenticated" | "loading",
) {
  return statusOverride ?? sessionStatus;
}

function resolveRealtimeUser(
  sessionUser: SessionUser | undefined,
  userOverride?: SessionUser | null,
): SessionUser | undefined {
  if (userOverride === null) {
    return undefined;
  }

  return userOverride ?? sessionUser;
}

function serializeScope(scope: RealtimeScope): string {
  return `${scope.kind}:${scope.id}`;
}

function dedupeScopes(scopes: RealtimeScope[]): RealtimeScope[] {
  const seen = new Set<string>();

  return scopes.filter((scope) => {
    const key = serializeScope(scope);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isEventAllowedForScope(event: string, scope: RealtimeScope): boolean {
  if (scope.kind === "workorder") {
    return false;
  }

  if (scope.kind === "ticket") {
    return event.startsWith("ticket.");
  }

  return true;
}

function resolveAdminSiteId(user: SessionUser): string | null {
  return user.primarySiteId ?? user.siteIds?.[0] ?? user.siteId ?? null;
}

function isSuperAdmin(user: SessionUser): boolean {
  return (
    user.isSuperAdmin === true ||
    user.role === "SUPER_ADMIN" ||
    user.role === "Super Admin"
  );
}

function getAdminNotificationScope(user: SessionUser): RealtimeScope | null {
  if (!user.accessAdminPanel) {
    return null;
  }

  const adminSiteId = resolveAdminSiteId(user);
  if (adminSiteId) {
    return {
      kind: "admin",
      id: `notifications.site.${adminSiteId}`,
    };
  }

  if (isSuperAdmin(user)) {
    return {
      kind: "admin",
      id: "notifications",
    };
  }

  return null;
}

function getSessionFingerprint(user?: SessionUser): string {
  return JSON.stringify({
    id: user?.id ?? null,
    role: user?.role ?? null,
    isSuperAdmin: user?.isSuperAdmin ?? false,
    accessAdminPanel: user?.accessAdminPanel ?? false,
    accessEmployeePanel: user?.accessEmployeePanel ?? false,
    tenantId: user?.tenantId ?? null,
    departmentId: user?.departmentId ?? null,
    primarySiteId: user?.primarySiteId ?? null,
    siteIds: user?.siteIds ?? null,
    siteId: user?.siteId ?? null,
  });
}

function getDefaultScopes(user: SessionUser): RealtimeScope[] {
  if (!user.id) {
    return [];
  }

  const scopes: RealtimeScope[] = [{ kind: "user", id: user.id }];

  if (user.departmentId && !user.accessAdminPanel) {
    scopes.push({ kind: "department", id: user.departmentId });
  }

  const adminNotificationScope = getAdminNotificationScope(user);
  if (adminNotificationScope) {
    scopes.push(adminNotificationScope);
  }

  return scopes;
}

export function RealtimeProvider({
  children,
  userOverride,
  statusOverride,
}: RealtimeProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [dynamicScopes, setDynamicScopes] = useState<RealtimeScope[]>([]);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const scopeRegistryRef = useRef(
    new Map<string, { scope: RealtimeScope; count: number }>(),
  );
  const sessionFingerprintRef = useRef<string | null>(null);
  const services = useMemo(() => getRealtimeClientServices(), []);
  const status = resolveAuthStatus(sessionStatus, statusOverride);
  const user = resolveRealtimeUser(
    session?.user as SessionUser | undefined,
    userOverride,
  );
  const sessionFingerprint = getSessionFingerprint(user);

  const scopes = useMemo(
    () =>
      dedupeScopes([...(user ? getDefaultScopes(user) : []), ...dynamicScopes]),
    [dynamicScopes, user],
  );

  const syncDynamicScopes = useCallback(() => {
    const nextScopes = Array.from(scopeRegistryRef.current.values()).map(
      (entry) => entry.scope,
    );
    setDynamicScopes(nextScopes);
  }, []);

  useEffect(() => {
    syncDynamicScopes();
  }, [syncDynamicScopes]);

  useEffect(() => {
    if (sessionFingerprintRef.current === sessionFingerprint) {
      return;
    }

    sessionFingerprintRef.current = sessionFingerprint;
    scopeRegistryRef.current.clear();
    setDynamicScopes([]);
    setIsFirebaseReady(false);
  }, [sessionFingerprint]);

  const subscribeScope = useCallback(
    (scope: RealtimeScope) => {
      const key = serializeScope(scope);
      const current = scopeRegistryRef.current.get(key);

      if (current) {
        current.count += 1;
      } else {
        scopeRegistryRef.current.set(key, { scope, count: 1 });
      }

      syncDynamicScopes();

      return () => {
        const active = scopeRegistryRef.current.get(key);
        if (!active) {
          return;
        }

        if (active.count <= 1) {
          scopeRegistryRef.current.delete(key);
        } else {
          active.count -= 1;
        }

        syncDynamicScopes();
      };
    },
    [syncDynamicScopes],
  );

  const reconnect = useCallback(() => {
    setReconnectVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id || !services.auth) {
      setIsFirebaseReady(false);
      setFirebaseError(null);
      if (services.auth) {
        void signOut(services.auth).catch(noop);
      }
      return;
    }

    let active = true;

    const authenticateFirebase = async () => {
      try {
        setFirebaseError(null);

        const currentUser = services.auth.currentUser;
        if (currentUser?.uid === user.id) {
          if (active) {
            setIsFirebaseReady(true);
          }
          return;
        }

        if (active) {
          setIsFirebaseReady(false);
        }

        if (currentUser) {
          await signOut(services.auth);
        }

        const response = await fetch("/api/auth/firebase-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const payload = (await response.json()) as FirebaseTokenResponse;

        if (!response.ok || !payload.token) {
          throw new Error(payload.error || "Gagal mengambil Firebase token.");
        }

        await signInWithCustomToken(services.auth, payload.token);

        if (active) {
          setIsFirebaseReady(true);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setIsFirebaseReady(false);
        setFirebaseError(
          error instanceof Error
            ? error.message
            : "Autentikasi Firebase gagal.",
        );
      }
    };

    void authenticateFirebase();

    return () => {
      active = false;
    };
  }, [services.auth, status, user?.id, reconnectVersion]);

  const isConnected =
    status === "authenticated" &&
    Boolean(user?.id) &&
    Boolean(services.firestore) &&
    isFirebaseReady &&
    services.auth?.currentUser?.uid === user?.id;
  const lastError =
    firebaseError ??
    (status === "authenticated" && user?.id && !services.firestore
      ? "Firebase realtime client belum tersedia."
      : status === "authenticated" && user?.id && !services.auth
        ? "Firebase auth client belum tersedia."
        : null);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !user?.id ||
      !services.realtimeDatabase ||
      !isFirebaseReady
    ) {
      return noop;
    }

    const presenceRef = ref(
      services.realtimeDatabase,
      buildPresencePath(user.id),
    );
    const createSnapshot = (online: boolean): PresenceSnapshot => {
      const timestamp = new Date().toISOString();

      return {
        userId: user.id as string,
        isOnline: online,
        source: "web",
        updatedAt: timestamp,
        lastSeenAt: timestamp,
      };
    };

    void onDisconnect(presenceRef).set(createSnapshot(false)).catch(noop);
    void set(presenceRef, createSnapshot(true)).catch(noop);

    return () => {
      void set(presenceRef, createSnapshot(false)).catch(noop);
    };
  }, [
    isFirebaseReady,
    services.realtimeDatabase,
    status,
    user?.id,
    reconnectVersion,
  ]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      socket: null,
      transport: DEFAULT_TRANSPORT,
      firestore: services.firestore,
      scopes,
      isConnected,
      lastError,
      reconnect,
      subscribeScope,
    }),
    [
      services.firestore,
      scopes,
      isConnected,
      lastError,
      reconnect,
      subscribeScope,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }

  return context;
}

export function useRealtimeSubscription<TPayload>(
  event: string,
  handler: (payload: TPayload) => void,
) {
  const { firestore, scopes, isConnected } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const canonicalEvent = useMemo(
    () =>
      LEGACY_TO_REALTIME_EVENT[
        event as keyof typeof LEGACY_TO_REALTIME_EVENT
      ] ?? event,
    [event],
  );

  const subscriptionEvents = useMemo(
    () =>
      new Set([
        event,
        canonicalEvent,
        ...getEventSubscriptionNames(canonicalEvent),
      ]),
    [canonicalEvent, event],
  );

  useEffect(() => {
    if (!firestore || !isConnected || scopes.length === 0) {
      return;
    }

    const allowedScopes = scopes.filter((scope) =>
      isEventAllowedForScope(canonicalEvent, scope),
    );

    const unsubscribes = allowedScopes.map((scope) => {
      const seenDocumentIds = new Set<string>();
      let hydrated = false;
      const channelQuery = query(
        collection(firestore, buildScopeChannel(scope)),
        orderBy("createdAt", "desc"),
        limit(20),
      );

      return onSnapshot(
        channelQuery,
        (snapshot) => {
          if (!hydrated) {
            snapshot.docs.forEach((document) => {
              seenDocumentIds.add(document.id);
            });
            hydrated = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type !== "added" || seenDocumentIds.has(change.doc.id)) {
              return;
            }

            seenDocumentIds.add(change.doc.id);
            const data = change.doc.data() as Partial<
              RealtimeEnvelope<TPayload>
            >;

            if (!data.type || !subscriptionEvents.has(data.type)) {
              return;
            }

            handlerRef.current((data.payload ?? data) as TPayload);
          });
        },
        (error) => {
          clientLogger.error("Realtime Firestore subscription failed", {
            scope: serializeScope(scope),
            channel: buildScopeChannel(scope),
            event,
            message: error.message,
            code: error.code,
          });
        },
      );
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, [
    canonicalEvent,
    event,
    firestore,
    isConnected,
    scopes,
    subscriptionEvents,
  ]);
}
