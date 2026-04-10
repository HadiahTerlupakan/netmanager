import { beforeEach, describe, expect, it, vi } from "vitest";

const canJoinRoomMock = vi.hoisted(() => vi.fn());
const resolveSocketAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/websocket/socket-auth", () => ({
  canJoinRoom: canJoinRoomMock,
  resolveSocketAuth: resolveSocketAuthMock,
}));

import {
  clearSocketRoomCleanupIntervalForTests,
  initializeSocketServer,
  resetSocketServerForTests,
} from "@/lib/websocket/server";
import { SOCKET_EVENTS } from "@/lib/websocket/types";

describe("initializeSocketServer room boundary", () => {
  let handlers: Record<string, (...args: unknown[]) => unknown>;
  let socket: {
    data: {
      userId: string;
      userRole: string;
      departmentId?: string;
      accessAdminPanel?: boolean;
    };
    join: ReturnType<typeof vi.fn>;
    leave: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    rooms: Set<string>;
  };
  let socketServer: {
    use: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    sockets: {
      adapter: { rooms: Map<string, { size: number }> };
      sockets: Map<string, unknown>;
    };
  };

  beforeEach(() => {
    clearSocketRoomCleanupIntervalForTests();
    resetSocketServerForTests();
    handlers = {};
    socket = {
      data: { userId: "user-1", userRole: "ADMIN", accessAdminPanel: true },
      join: vi.fn(),
      leave: vi.fn(),
      on: vi.fn((event, handler) => {
        handlers[String(event)] = handler as (...args: unknown[]) => unknown;
      }),
      emit: vi.fn(),
      rooms: new Set(["socket-1", "room-1"]),
    };
    socketServer = {
      use: vi.fn(),
      on: vi.fn((event, handler) => {
        handlers[String(event)] = handler as (...args: unknown[]) => unknown;
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      in: vi.fn(() => ({ fetchSockets: vi.fn().mockResolvedValue([]) })),
      sockets: {
        adapter: { rooms: new Map() },
        sockets: new Map(),
      },
    };
    canJoinRoomMock.mockReset();
    resolveSocketAuthMock.mockReset();
    resolveSocketAuthMock.mockResolvedValue({
      userId: "user-1",
      userRole: "ADMIN",
      accessAdminPanel: true,
    });
    canJoinRoomMock.mockResolvedValue(true);
    vi.clearAllMocks();
    initializeSocketServer(socketServer as never);
  });

  it("joins and leaves rooms from object payloads with room keys", async () => {
    await handlers.connection(socket);

    await handlers[SOCKET_EVENTS.JOIN_ROOM]({ room: "workorder:wo-1" });
    handlers[SOCKET_EVENTS.LEAVE_ROOM]({ room: "workorder:wo-1" });

    expect(canJoinRoomMock).toHaveBeenCalledWith(socket.data, "workorder:wo-1");
    expect(socket.join).toHaveBeenCalledWith("workorder:wo-1");
    expect(socket.leave).toHaveBeenCalledWith("workorder:wo-1");
  });

  it("ignores invalid or missing room payloads", async () => {
    await handlers.connection(socket);
    socket.join.mockClear();
    socket.leave.mockClear();

    await handlers[SOCKET_EVENTS.JOIN_ROOM]({});
    await handlers[SOCKET_EVENTS.JOIN_ROOM](null);
    handlers[SOCKET_EVENTS.LEAVE_ROOM]({});
    handlers[SOCKET_EVENTS.LEAVE_ROOM](undefined);

    expect(canJoinRoomMock).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("does not re-register middleware or connection handlers when initialized twice with the same server", () => {
    expect(socketServer.use).toHaveBeenCalledTimes(1);
    expect(socketServer.on).toHaveBeenCalledTimes(1);

    initializeSocketServer(socketServer as never);

    expect(socketServer.use).toHaveBeenCalledTimes(1);
    expect(socketServer.on).toHaveBeenCalledTimes(1);
  });
});
