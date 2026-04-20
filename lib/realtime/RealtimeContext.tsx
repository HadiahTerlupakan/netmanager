"use client";

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
  siteId?: string | null;
  accessAdminPanel?: boolean;
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

function getDefaultScopes(user: SessionUser): RealtimeScope[] {
  if (!user.id) {
    return [];
  }

  const scopes: RealtimeScope[] = [{ kind: "user", id: user.id }];

  if (user.departmentId) {
    scopes.push({ kind: "department", id: user.departmentId });
  }

  if (user.accessAdminPanel) {
    scopes.push({ kind: "admin", id: "notifications" });

    if (user.siteId) {
      scopes.push({ kind: "admin", id: `notifications.site.${user.siteId}` });
    }
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
  const scopeRegistryRef = useRef(
    new Map<string, { scope: RealtimeScope; count: number }>(),
  );
  const services = useMemo(() => getRealtimeClientServices(), []);
  const status = resolveAuthStatus(sessionStatus, statusOverride);
  const user = resolveRealtimeUser(
    session?.user as SessionUser | undefined,
    userOverride,
  );

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

  const isConnected =
    status === "authenticated" &&
    Boolean(user?.id) &&
    Boolean(services.firestore);
  const lastError =
    status === "authenticated" && user?.id && !services.firestore
      ? "Firebase realtime client belum tersedia."
      : null;

  useEffect(() => {
    if (status !== "authenticated" || !user?.id || !services.realtimeDatabase) {
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
  }, [services.realtimeDatabase, status, user?.id, reconnectVersion]);

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

  const subscriptionEvents = useMemo(() => {
    const canonicalEvent =
      LEGACY_TO_REALTIME_EVENT[
        event as keyof typeof LEGACY_TO_REALTIME_EVENT
      ] ?? event;

    return new Set([
      event,
      canonicalEvent,
      ...getEventSubscriptionNames(canonicalEvent),
    ]);
  }, [event]);

  useEffect(() => {
    if (!firestore || !isConnected || scopes.length === 0) {
      return;
    }

    const unsubscribes = scopes.map((scope) => {
      const seenDocumentIds = new Set<string>();
      let hydrated = false;
      const channelQuery = query(
        collection(firestore, buildScopeChannel(scope)),
        orderBy("createdAt", "desc"),
        limit(20),
      );

      return onSnapshot(channelQuery, (snapshot) => {
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
          const data = change.doc.data() as Partial<RealtimeEnvelope<TPayload>>;

          if (!data.type || !subscriptionEvents.has(data.type)) {
            return;
          }

          handlerRef.current((data.payload ?? data) as TPayload);
        });
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, [firestore, isConnected, scopes, subscriptionEvents]);
}
