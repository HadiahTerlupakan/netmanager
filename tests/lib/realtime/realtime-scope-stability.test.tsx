// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeListeners,
  channelEvent,
  disconnectChannel,
  fakeRealtime,
  signInAs,
  syncChannel,
} from "./firestore-channel-fake";
import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { useRealtimeNotifications } from "@/lib/websocket/hooks/useRealtimeNotifications";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  tenantId: "tenant-1",
  accessAdminPanel: true,
  primarySiteId: "site-1",
  siteIds: ["site-1"],
};
const ADMIN_CHANNEL = "admins/notifications.site.site-1/events";
const USER_CHANNEL = "users/admin-1/events";
const WORKORDER_SCOPE = {
  kind: "admin" as const,
  id: "workorders.site.site-1",
};
const STARTED_AT = Date.parse("2026-11-01T08:00:00.000Z");

const history = [
  channelEvent("old-1", {
    createdAt: new Date(STARTED_AT - 60_000).toISOString(),
  }),
];

function NotificationListener(): null {
  useRealtimeEvent("notification.new", () => {});
  return null;
}

function WorkOrderScope(): null {
  useRealtimeScope(WORKORDER_SCOPE);
  return null;
}

function NotificationBadge(): React.JSX.Element {
  const { unreadCount } = useRealtimeNotifications();
  return <output>{unreadCount}</output>;
}

/**
 * Mencatat listener yang hidup sekarang; `expectSameListeners` lalu memastikan
 * tidak ada `onSnapshot` baru dan tidak ada yang dilepas.
 */
function recordListeners() {
  return {
    created: fakeRealtime.listeners.length,
    live: fakeRealtime.listeners.filter((listener) => listener.isActive),
  };
}

function expectSameListeners(recorded: ReturnType<typeof recordListeners>) {
  expect(fakeRealtime.listeners).toHaveLength(recorded.created);
  expect(recorded.live.length).toBeGreaterThan(0);
  expect(recorded.live.every((listener) => listener.isActive)).toBe(true);
}

describe("realtime scopes stay put while nothing relevant changes", () => {
  let root: Root;

  function render(children: React.ReactNode, status = "authenticated") {
    act(() =>
      root.render(
        <RealtimeProvider
          statusOverride={status as "authenticated" | "loading"}
        >
          {children}
        </RealtimeProvider>,
      ),
    );
  }

  beforeEach(() => {
    signInAs(ADMIN);
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("keeps every listener when NextAuth reloads an identical session as the tab regains focus", () => {
    render(<NotificationListener />);
    const before = recordListeners();

    fakeRealtime.session = {
      status: "authenticated",
      data: { user: { ...ADMIN, siteIds: [...ADMIN.siteIds] } },
    };
    render(<NotificationListener />);

    expectSameListeners(before);
  });

  it("keeps every listener when another component registers a scope already registered", () => {
    render(
      <>
        <NotificationListener />
        <WorkOrderScope />
      </>,
    );
    const before = recordListeners();

    render(
      <>
        <NotificationListener />
        <WorkOrderScope />
        <WorkOrderScope />
      </>,
    );

    expectSameListeners(before);
  });

  it("keeps every listener when a wrapper passes a new object for the same user", () => {
    const renderCustomer = () =>
      act(() =>
        root.render(
          <RealtimeProvider
            userOverride={{ id: "admin-1" }}
            statusOverride="authenticated"
          >
            <NotificationListener />
          </RealtimeProvider>,
        ),
      );
    renderCustomer();
    const before = recordListeners();

    renderCustomer();

    expectSameListeners(before);
  });

  it("still listens on a new channel when a page adds a scope", () => {
    render(<NotificationListener />);
    expect(
      activeListeners("admins/workorders.site.site-1/events"),
    ).toHaveLength(0);

    render(
      <>
        <NotificationListener />
        <WorkOrderScope />
      </>,
    );

    expect(
      activeListeners("admins/workorders.site.site-1/events"),
    ).toHaveLength(1);
    expect(activeListeners(ADMIN_CHANNEL)).toHaveLength(1);
  });
});

describe("hooks refetch once after realtime re-synchronises", () => {
  let container: HTMLDivElement;
  let root: Root;
  let serverUnreadCount: number;
  let countRequests: number;

  const badge = () => container.querySelector("output")?.textContent;

  async function settle(ms = 0) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function openPage(
    status: "authenticated" | "loading" = "authenticated",
  ) {
    act(() =>
      root.render(
        <RealtimeProvider statusOverride={status}>
          <NotificationBadge />
        </RealtimeProvider>,
      ),
    );
    await settle();
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: STARTED_AT });
    serverUnreadCount = 3;
    countRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        countRequests += 1;
        return {
          ok: true,
          json: async () => ({
            notifications: [],
            unreadCount: serverUnreadCount,
          }),
        } as Response;
      }),
    );
    signInAs(ADMIN);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not refetch after the first sync when the page opens", async () => {
    await openPage();
    act(() => syncChannel(ADMIN_CHANNEL, history));
    await settle(5_000);

    expect(countRequests).toBe(1);
  });

  it("refetches once, after re-hydrating, to count what landed while the connection was down", async () => {
    await openPage();
    act(() => syncChannel(ADMIN_CHANNEL, history));
    act(() => syncChannel(USER_CHANNEL, history));
    await settle(5_000);

    await openPage("loading");
    await openPage();
    // Notifikasi yang tiba selagi terputus ikut di sinkronisasi pertama
    // listener baru, jadi tidak pernah datang sebagai event. Channel-channel
    // tersinkron ulang pada saat yang berbeda; tetap satu kali muat ulang.
    serverUnreadCount = 4;
    const landedWhileDown = channelEvent("landed-while-down");
    act(() => disconnectChannel(ADMIN_CHANNEL));
    act(() => syncChannel(ADMIN_CHANNEL, [landedWhileDown, ...history]));
    await settle(300);
    act(() => syncChannel(USER_CHANNEL, history));
    // Dua langkah: muat ulang dari channel pertama selesai lebih dulu, supaya
    // muat ulang kedua (bila ada) terlihat terpisah.
    await settle(800);
    await settle(5_000);

    expect(countRequests).toBe(2);
    expect(badge()).toBe("4");
  });

  it("refetches once after the SDK catches up from the cache", async () => {
    await openPage();
    act(() => syncChannel(ADMIN_CHANNEL, history));
    await settle(5_000);

    act(() => disconnectChannel(ADMIN_CHANNEL));
    serverUnreadCount = 9;
    act(() => syncChannel(ADMIN_CHANNEL, [channelEvent("missed"), ...history]));
    await settle(5_000);

    expect(countRequests).toBe(2);
    expect(badge()).toBe("9");
  });
});
