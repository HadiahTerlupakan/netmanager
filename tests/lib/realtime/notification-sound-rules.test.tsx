// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  channelEvent,
  disconnectChannel,
  signInAs,
  syncChannel,
} from "./firestore-channel-fake";
import {
  NOTIFICATION_QUIET_PERIOD_MS,
  NOTIFICATION_SOUND_THROTTLE_MS,
} from "@/lib/notification-sound";
import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useCustomerNotifications } from "@/lib/websocket/hooks/useCustomerNotifications";
import { useRealtimeNotifications } from "@/lib/websocket/hooks/useRealtimeNotifications";
import { useRealtimePaymentApprovals } from "@/lib/websocket/hooks/useRealtimePaymentApprovals";
import { useRealtimeSupportTickets } from "@/lib/websocket/hooks/useRealtimeSupportTickets";
import { useRealtimeWorkOrders } from "@/lib/websocket/hooks/useRealtimeWorkOrders";

vi.mock("@/hooks/use-permission", () => {
  const permission = { hasPermission: () => true, isLoading: false };
  return { usePermission: () => permission };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Aturan pemilik untuk nada notifikasi, diuji lewat hook yang sungguhan:
 * 1. membuka halaman selalu diam, berapa pun notifikasi yang menumpuk;
 * 2. sesudah jeda tenang, rentetan event berbunyi paling banyak sekali per
 *    jendela throttle;
 * 3. tersambung ulang (koneksi, scope, tab kembali aktif) seperti membuka
 *    halaman: tidak memutar ulang dan tidak berbunyi;
 * 4. portal pelanggan mengikuti aturan yang sama.
 */

const FIRST_OPENED_AT = Date.parse("2026-11-01T08:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ADMIN = {
  id: "admin-1",
  accessAdminPanel: true,
  primarySiteId: "site-1",
};
const ADMIN_CHANNEL = "admins/notifications.site.site-1/events";
const CUSTOMER = { id: "cust-1" };
const CUSTOMER_CHANNEL = "users/cust-1/events";

const play = vi.fn<() => Promise<void>>();

function notificationEvent(id: string, type = "GENERAL") {
  return channelEvent(id, {
    payload: {
      id,
      type,
      priority: "NORMAL",
      title: `Notifikasi ${id}`,
      message: "Isi",
      createdAt: new Date().toISOString(),
    },
  });
}

const piledUp = Array.from({ length: 20 }, (_, index) =>
  channelEvent(`old-${index}`, {
    createdAt: new Date(FIRST_OPENED_AT - (index + 1) * MINUTE).toISOString(),
  }),
);

/** Hook-hook lonceng di Navbar admin, masing-masing dulu berbunyi sendiri. */
function StaffBells(): React.JSX.Element {
  const general = useRealtimeNotifications();
  const workOrders = useRealtimeWorkOrders();
  useRealtimeSupportTickets();
  useRealtimePaymentApprovals();
  return (
    <output>
      {general.unreadCount}|{workOrders.unreadCount}
    </output>
  );
}

function CustomerBell(): React.JSX.Element {
  const { unreadCount, refresh } = useCustomerNotifications();
  return (
    <>
      <output>{unreadCount}</output>
      <button type="button" onClick={() => void refresh()} />
    </>
  );
}

function respond(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe("notification sound rules", () => {
  let container: HTMLDivElement;
  let root: Root;
  let customerUnreadCounts: number[];
  let testsRun = 0;

  const badges = () => container.querySelector("output")?.textContent;

  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  async function openAdminPage(
    status: "authenticated" | "loading" = "authenticated",
  ) {
    act(() =>
      root.render(
        <RealtimeProvider statusOverride={status}>
          <StaffBells />
        </RealtimeProvider>,
      ),
    );
    await settle();
  }

  /** Halaman admin yang sudah terbuka lebih lama dari jeda tenang. */
  async function openSettledAdminPage() {
    await openAdminPage();
    act(() => syncChannel(ADMIN_CHANNEL, piledUp));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
    });
  }

  async function receive(
    channel: string,
    events: ReturnType<typeof channelEvent>[],
  ) {
    act(() => syncChannel(channel, events));
    await settle();
  }

  beforeEach(() => {
    // Satu modul nada untuk seluruh berkas, seperti satu tab: tiap tes dibuka
    // sehari setelah tes sebelumnya supaya waktu tetap maju dan nada atau
    // jeda dari tes lain sudah lama lewat.
    vi.useFakeTimers({ now: FIRST_OPENED_AT + testsRun++ * DAY });
    localStorage.clear();
    play.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { play: typeof play }) {
        this.play = play;
      }),
    );
    customerUnreadCounts = [2];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/customer/notifications")) {
          const unreadCount =
            customerUnreadCounts.length > 1
              ? customerUnreadCounts.shift()
              : customerUnreadCounts[0];
          return respond({ unreadCount, notifications: [], announcements: [] });
        }
        if (url.includes("type=WORK_ORDER")) {
          return respond({ notifications: [] });
        }
        if (url.startsWith("/api/admin/support-tickets/unread-count")) {
          return respond({ count: 0 });
        }
        if (url.startsWith("/api/admin/support-tickets")) {
          return respond({ tickets: [] });
        }
        if (url.startsWith("/api/admin/payments/pending-manual")) {
          return respond({ success: true, data: [] });
        }
        return respond({ notifications: [], unreadCount: 3 });
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

  /**
   * Notifikasi WORK_ORDER ditangani dua hook; tiket baru dan pembayaran
   * manual masing-masing punya hook sendiri.
   */
  function staffBurst() {
    return [
      notificationEvent("wo-1", "WORK_ORDER"),
      notificationEvent("wo-2", "WORK_ORDER"),
      channelEvent("ticket-1", {
        type: "ticket.new",
        payload: { id: "ticket-1", ticketNumber: "T-1" },
      }),
      channelEvent("payment-1", {
        type: "payment.pending.new",
        payload: { id: "payment-1" },
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        notificationEvent(`burst-${index}`),
      ),
    ];
  }

  describe("1. opening a page is silent", () => {
    it("loads piled-up notifications as badges only, and keeps new ones silent during the quiet period", async () => {
      await openAdminPage();
      act(() => disconnectChannel(ADMIN_CHANNEL));
      act(() => syncChannel(ADMIN_CHANNEL, piledUp));
      expect(badges()).toBe("3|0");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      await receive(ADMIN_CHANNEL, [notificationEvent("new-1"), ...piledUp]);
      expect(badges()).toBe("4|0");
      expect(play).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
      });
      await receive(ADMIN_CHANNEL, [notificationEvent("new-2"), ...piledUp]);
      expect(badges()).toBe("5|0");
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("stays silent until the server has answered, however long that takes", async () => {
      await openAdminPage();
      act(() => disconnectChannel(ADMIN_CHANNEL));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      act(() => syncChannel(ADMIN_CHANNEL, piledUp));
      await settle();

      expect(play).not.toHaveBeenCalled();
      expect(badges()).toBe("3|0");
    });
  });

  describe("2. a burst rings once per window", () => {
    it("rings once for many events handled by several hooks, then waits out the window", async () => {
      await openSettledAdminPage();

      const burst = staffBurst();
      await receive(ADMIN_CHANNEL, [...burst, ...piledUp]);
      expect(badges()).toBe("13|2");
      expect(play).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await receive(ADMIN_CHANNEL, [
        notificationEvent("burst-late"),
        ...burst,
        ...piledUp,
      ]);
      expect(play).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_SOUND_THROTTLE_MS);
      });
      await receive(ADMIN_CHANNEL, [
        notificationEvent("after-window"),
        notificationEvent("burst-late"),
        ...burst,
        ...piledUp,
      ]);
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("stays silent in every hook when the staff ringtone is switched off", async () => {
      localStorage.setItem("chat_sound_enabled", "false");
      await openSettledAdminPage();

      await receive(ADMIN_CHANNEL, [...staffBurst(), ...piledUp]);

      expect(badges()).toBe("13|2");
      expect(play).not.toHaveBeenCalled();
    });

    it("stays silent when another tab rang for the same event a moment ago", async () => {
      await openSettledAdminPage();
      localStorage.setItem(
        "notification_sound_last_played_at",
        String(Date.now() - 500),
      );

      await receive(ADMIN_CHANNEL, [notificationEvent("new-1"), ...piledUp]);

      expect(badges()).toBe("4|0");
      expect(play).not.toHaveBeenCalled();
    });
  });

  describe("3. reconnecting is like opening the page", () => {
    it("replays nothing and rings for nothing after the connection drops and comes back", async () => {
      await openSettledAdminPage();
      await openAdminPage("loading");
      await openAdminPage();

      const whileAway = notificationEvent("while-away");
      act(() => disconnectChannel(ADMIN_CHANNEL));
      await receive(ADMIN_CHANNEL, [whileAway, ...piledUp]);
      expect(play).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await receive(ADMIN_CHANNEL, [
        notificationEvent("right-after"),
        whileAway,
        ...piledUp,
      ]);
      expect(badges()).toBe("4|0");
      expect(play).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
      });
      await receive(ADMIN_CHANNEL, [
        notificationEvent("later"),
        notificationEvent("right-after"),
        whileAway,
        ...piledUp,
      ]);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("updates the badges silently with what came in while the laptop slept", async () => {
      await openSettledAdminPage();

      act(() => disconnectChannel(ADMIN_CHANNEL));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8 * 60 * MINUTE);
      });
      const overnight = Array.from({ length: 6 }, (_, index) =>
        notificationEvent(`overnight-${index}`),
      );
      await receive(ADMIN_CHANNEL, [...overnight, ...piledUp]);

      expect(badges()).toBe("9|0");
      expect(play).not.toHaveBeenCalled();
    });

    it.each([
      ["the tab becomes visible again", () => document, "visibilitychange"],
      ["a frozen tab resumes", () => document, "resume"],
      ["the network comes back", () => window, "online"],
    ] as const)(
      "keeps the next few seconds silent when %s",
      async (_moment, getTarget, eventName) => {
        await openSettledAdminPage();

        act(() => {
          getTarget().dispatchEvent(new Event(eventName));
        });
        await receive(ADMIN_CHANNEL, [notificationEvent("new-1"), ...piledUp]);

        expect(badges()).toBe("4|0");
        expect(play).not.toHaveBeenCalled();
      },
    );
  });

  describe("4. the customer portal follows the same rules", () => {
    async function openCustomerPortal() {
      signInAs(CUSTOMER);
      act(() =>
        root.render(
          <RealtimeProvider
            userOverride={CUSTOMER}
            statusOverride="authenticated"
          >
            <CustomerBell />
          </RealtimeProvider>,
        ),
      );
      await settle();
      act(() => syncChannel(CUSTOMER_CHANNEL, piledUp));
    }

    async function openBell() {
      act(() => container.querySelector("button")?.click());
      await settle();
    }

    it("stays silent for a rise the bell finds right after opening, before realtime connects", async () => {
      customerUnreadCounts = [2, 3, 4];
      signInAs(CUSTOMER);
      act(() =>
        root.render(
          <RealtimeProvider userOverride={CUSTOMER} statusOverride="loading">
            <CustomerBell />
          </RealtimeProvider>,
        ),
      );
      await settle();

      await openBell();
      expect(badges()).toBe("3");
      expect(play).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
      });
      await openBell();
      expect(badges()).toBe("4");
      expect(play).toHaveBeenCalledTimes(1);
    });

    const ticketReply = (id: string) =>
      channelEvent(id, { type: "ticket.reply", payload: { id } });

    it("stays silent on open and during the quiet period, then rings once for a rise", async () => {
      customerUnreadCounts = [2, 3, 4];
      await openCustomerPortal();
      expect(badges()).toBe("2");

      await receive(CUSTOMER_CHANNEL, [ticketReply("reply-1"), ...piledUp]);
      expect(badges()).toBe("3");
      expect(play).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
      });
      await receive(CUSTOMER_CHANNEL, [
        ticketReply("reply-2"),
        ticketReply("reply-1"),
        ...piledUp,
      ]);
      expect(badges()).toBe("4");
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("rings once for a burst of replies", async () => {
      customerUnreadCounts = [2, 3, 4, 5, 6, 7];
      await openCustomerPortal();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_QUIET_PERIOD_MS);
      });

      const replies = Array.from({ length: 5 }, (_, index) =>
        ticketReply(`reply-${index}`),
      );
      await receive(CUSTOMER_CHANNEL, [...replies, ...piledUp]);

      expect(play).toHaveBeenCalledTimes(1);
    });
  });
});
