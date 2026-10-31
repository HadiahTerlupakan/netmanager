// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  playSound: vi.fn(),
  handlers: new Map<string, (payload: unknown) => void>(),
}));

vi.mock("@/lib/notification-sound", () => ({
  playCustomerNotificationSound: mocks.playSound,
}));
vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: () => ({ isConnected: true }),
}));
vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: (event: string, handler: (payload: unknown) => void) => {
    mocks.handlers.set(event, handler);
  },
}));

import { useCustomerNotifications } from "@/lib/websocket/hooks/useCustomerNotifications";

function Probe(): null {
  useCustomerNotifications();
  return null;
}

function respondWithUnread(unreadCount: number) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ unreadCount, notifications: [], announcements: [] }),
  } as Response);
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function receive(event: string) {
  await act(async () => {
    mocks.handlers.get(event)?.({ title: "x" });
  });
  await flush();
}

describe("useCustomerNotifications sound", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.playSound.mockReset();
    mocks.handlers.clear();
    vi.stubGlobal("fetch", vi.fn());
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("stays silent for notifications that were already unread on load", async () => {
    respondWithUnread(2);
    act(() => root.render(<Probe />));
    await flush();

    expect(mocks.playSound).not.toHaveBeenCalled();
  });

  it("plays once when a realtime event brings a new unread notification", async () => {
    respondWithUnread(2);
    act(() => root.render(<Probe />));
    await flush();

    respondWithUnread(3);
    await receive("ticket.reply");

    expect(mocks.playSound).toHaveBeenCalledTimes(1);
  });

  it("stays silent when an event brings nothing new for this customer", async () => {
    // announcement.new juga menyala untuk pengumuman portal lain; tanpa
    // tambahan unread, pelanggan ini tidak menerima apa-apa.
    respondWithUnread(2);
    act(() => root.render(<Probe />));
    await flush();

    respondWithUnread(2);
    await receive("announcement.new");

    expect(mocks.playSound).not.toHaveBeenCalled();
  });
});
