// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeListeners,
  channelEvent,
  fakeRealtime,
  mintTokenForCurrentSession,
  signInAs,
  syncChannel,
} from "./firestore-channel-fake";
// Sesudah fake: modul ini dipalsukan oleh berkas di atas.
import { signInWithCustomToken } from "firebase/auth";
import { playStaffNotificationSound } from "@/lib/notification-sound";
import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Aturan Firestore membaca klaim token Firebase (role, tenant, site). Bila
 * sesi berpindah site, role, atau tenant tanpa berganti pengguna, token lama
 * membawa klaim lama: realtime harus mencetak token baru, masuk ulang, lalu
 * memasang listener di channel yang baru — dengan diam, seperti halaman yang
 * baru dibuka.
 */

const ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  tenantId: "tenant-1",
  accessAdminPanel: true,
  primarySiteId: "site-1",
  siteIds: ["site-1"],
};
const SITE_1_CHANNEL = "admins/notifications.site.site-1/events";
const SITE_2_CHANNEL = "admins/notifications.site.site-2/events";
const STARTED_AT = Date.parse("2026-11-01T08:00:00.000Z");

const play = vi.fn<() => Promise<void>>();
const received: unknown[] = [];
const tokenRequests = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/auth/firebase-token");

function RingingListener(): null {
  useRealtimeEvent("notification.new", (payload: unknown) => {
    received.push(payload);
    playStaffNotificationSound();
  });
  return null;
}

describe("Firebase re-authentication when the session's claims change", () => {
  let root: Root;

  async function render() {
    act(() =>
      root.render(
        <RealtimeProvider statusOverride="authenticated">
          <RingingListener />
        </RealtimeProvider>,
      ),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  /** NextAuth memuat sesi baru untuk pengguna yang sama. */
  function switchSession(changes: Record<string, unknown>) {
    fakeRealtime.session = {
      status: "authenticated",
      data: { user: { ...ADMIN, ...changes } },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: STARTED_AT });
    play.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { play: typeof play }) {
        this.play = play;
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ token: mintTokenForCurrentSession() }),
      })),
    );
    vi.mocked(signInWithCustomToken).mockClear();
    received.length = 0;
    localStorage.clear();
    signInAs(ADMIN);
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reuses the remembered Firebase session when its claims are still current", async () => {
    await render();

    expect(tokenRequests()).toHaveLength(0);
    expect(activeListeners(SITE_1_CHANNEL)).toHaveLength(1);
  });

  it("mints a new token and moves to the new site's channel when the admin switches site", async () => {
    await render();

    switchSession({ primarySiteId: "site-2", siteIds: ["site-2"] });
    await render();

    expect(tokenRequests()).toHaveLength(1);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(1);
    const { claims } =
      await fakeRealtime.services.auth.currentUser!.getIdTokenResult();
    expect(claims).toMatchObject({ siteId: "site-2", primarySiteId: "site-2" });
    expect(activeListeners(SITE_1_CHANNEL)).toHaveLength(0);
    expect(activeListeners(SITE_2_CHANNEL)).toHaveLength(1);
  });

  it.each([
    ["the role", { role: "TEKNISI" }],
    ["the tenant", { tenantId: "tenant-2" }],
  ])(
    "mints a new token and reconnects when %s changes",
    async (_field, changes) => {
      await render();

      switchSession(changes);
      await render();

      expect(tokenRequests()).toHaveLength(1);
      expect(activeListeners(SITE_1_CHANNEL)).toHaveLength(1);
    },
  );

  it("reconnects without a new token when only fields outside the claims change", async () => {
    await render();

    switchSession({ siteIds: ["site-1", "site-3"] });
    await render();

    expect(tokenRequests()).toHaveLength(0);
    expect(activeListeners(SITE_1_CHANNEL)).toHaveLength(1);
  });

  it("mints a new token at page load when the remembered session carries old claims", async () => {
    switchSession({ primarySiteId: "site-2", siteIds: ["site-2"] });

    await render();

    expect(tokenRequests()).toHaveLength(1);
    expect(activeListeners(SITE_2_CHANNEL)).toHaveLength(1);
  });

  it("re-hydrates the new channel silently", async () => {
    await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    switchSession({ primarySiteId: "site-2", siteIds: ["site-2"] });
    await render();
    expect(activeListeners(SITE_2_CHANNEL)).toHaveLength(1);
    const pending = channelEvent("waiting-on-site-2", {
      createdAt: new Date(STARTED_AT).toISOString(),
    });
    const arriving = channelEvent("arriving");
    act(() => syncChannel(SITE_2_CHANNEL, [pending]));
    act(() => syncChannel(SITE_2_CHANNEL, [arriving, pending]));

    expect(received).toEqual([arriving.data().payload]);
    expect(play).not.toHaveBeenCalled();
  });
});
