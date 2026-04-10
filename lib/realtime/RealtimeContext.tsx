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
import { io, type Socket } from "socket.io-client";

import { getEventSubscriptionNames } from "@/lib/realtime/channel-map";

export interface RealtimeTransport {
  emit: Socket["emit"];
  on: Socket["on"];
  off: Socket["off"];
}

export interface RealtimeConnectionState {
  socket: Socket | null;
  transport: RealtimeTransport | null;
  isConnected: boolean;
  lastError: string | null;
  reconnect: () => void;
}

export function createRealtimeTransport(socket: Socket): RealtimeTransport {
  return {
    emit: socket.emit.bind(socket),
    on: socket.on.bind(socket),
    off: socket.off.bind(socket),
  };
}

const RealtimeContext = createContext<RealtimeConnectionState | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      return;
    }

    const user = session.user as {
      id?: string;
      role?: string;
      departmentId?: string;
      accessAdminPanel?: boolean;
    };

    if (!user.id) {
      console.warn("[WS] No user ID available for socket connection");
      return;
    }

    const socketInstance = io({
      path: "/api/socket",
      withCredentials: true,
      auth: {
        userId: user.id,
        userRole: user.role || "USER",
        departmentId: user.departmentId,
        accessAdminPanel: user.accessAdminPanel,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket"],
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setLastError(null);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      setLastError(error.message);
      setIsConnected(false);
    });

    socketInstance.on("reconnect", () => {
      setIsConnected(true);
      setLastError(null);
    });

    socketInstance.on("reconnect_failed", () => {
      setLastError("Koneksi terputus. Silakan refresh halaman.");
    });

    queueMicrotask(() => {
      setSocket(socketInstance);
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [session, status]);

  const reconnect = useCallback(() => {
    if (socket?.connected) {
      socket.disconnect();
      socket.connect();
      return;
    }

    socket?.connect();
  }, [socket]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        socket &&
        !socket.connected
      ) {
        socket.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket]);

  const transport = useMemo(
    () => (socket ? createRealtimeTransport(socket) : null),
    [socket],
  );

  return (
    <RealtimeContext.Provider
      value={{ socket, transport, isConnected, lastError, reconnect }}
    >
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
  const { socket, transport, isConnected } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const activeTransport =
    transport ?? (socket ? createRealtimeTransport(socket) : null);

  useEffect(() => {
    if (!activeTransport || !isConnected) {
      return;
    }

    const listener = (payload: TPayload) => {
      handlerRef.current(payload);
    };
    const subscriptionEvents = getEventSubscriptionNames(event);

    subscriptionEvents.forEach((subscriptionEvent) => {
      activeTransport.on(subscriptionEvent, listener);
    });

    return () => {
      subscriptionEvents.forEach((subscriptionEvent) => {
        activeTransport.off(subscriptionEvent, listener);
      });
    };
  }, [activeTransport, event, isConnected]);
}
