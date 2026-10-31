// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeListeners,
  channelEvent,
  fakeRealtime,
  rememberFirebaseUser,
  syncChannel,
} from "./firestore-channel-fake";
// Sesudah fake: modul ini dipalsukan oleh berkas di atas.
import { signInWithCustomToken } from "firebase/auth";
import CustomerRealtimeProviderWrapper from "@/components/providers/CustomerRealtimeProviderWrapper";
import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useRealtimeTicketChat } from "@/lib/websocket/hooks/useRealtimeTicketChat";

vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ customer: { id: "cust-1" }, isLoading: false }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Portal pelanggan tidak punya sesi NextAuth; ia masuk ke Firebase dengan
 * token dari cookie sesi pelanggan. Token itu hanya membuka kanal pelanggan
 * sendiri (`users/<uid>/events`), tempat pengumuman, balasan tiket, dan pesan
 * tiketnya dikirim.
 */

const CUSTOMER = { id: "cust-1" };
const CUSTOMER_CHANNEL = "users/cust-1/events";
const CUSTOMER_CLAIMS: Record<string, unknown> = {
  role: "CUSTOMER",
  tenantId: null,
  departmentId: null,
  siteId: null,
  primarySiteId: null,
  accessAdminPanel: false,
  accessEmployeePanel: false,
  isSuperAdmin: false,
};

const tokenRequestsTo = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => url === path);

/** Halaman tiket memakai `ticket?.replies || []`: array kosong baru tiap render. */
function LoadingTicketChat({ ticket }: { ticket: null }): React.JSX.Element {
  const { replies } = useRealtimeTicketChat({
    ticketId: "ticket-1",
    initialReplies: (ticket as { replies?: never[] } | null)?.replies || [],
  });
  return <output>{replies.length}</output>;
}

function TicketChat(): React.JSX.Element {
  const { replies } = useRealtimeTicketChat({ ticketId: "ticket-1" });
  return <output>{replies.map((reply) => reply.id).join(",")}</output>;
}

describe("customer portal realtime", () => {
  let container: HTMLDivElement;
  let root: Root;

  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  async function renderCustomerPortal() {
    await act(async () => {
      root.render(
        <RealtimeProvider
          audience="customer"
          userOverride={CUSTOMER}
          statusOverride="authenticated"
        >
          <TicketChat />
        </RealtimeProvider>,
      );
    });
    await settle();
  }

  beforeEach(() => {
    fakeRealtime.listeners.length = 0;
    fakeRealtime.session = { status: "unauthenticated", data: null };
    fakeRealtime.services.auth.currentUser = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          token: JSON.stringify({ uid: "cust-1", claims: CUSTOMER_CLAIMS }),
        }),
      })),
    );
    vi.mocked(signInWithCustomToken).mockClear();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("signs a customer in through the customer token route, never the staff route", async () => {
    await renderCustomerPortal();

    expect(tokenRequestsTo("/api/customer/firebase-token")).toHaveLength(1);
    expect(tokenRequestsTo("/api/auth/firebase-token")).toHaveLength(0);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(1);
    expect(activeListeners(CUSTOMER_CHANNEL)).toHaveLength(1);
  });

  it("reuses a remembered customer session that carries customer-only claims", async () => {
    rememberFirebaseUser("cust-1", CUSTOMER_CLAIMS);

    await renderCustomerPortal();

    expect(tokenRequestsTo("/api/customer/firebase-token")).toHaveLength(0);
    expect(activeListeners(CUSTOMER_CHANNEL)).toHaveLength(1);
  });

  it("mints a new token when the remembered session carries staff claims for the same uid", async () => {
    // Rute token mobile menyimpan klaim ber-tenant untuk uid pelanggan.
    rememberFirebaseUser("cust-1", {
      ...CUSTOMER_CLAIMS,
      tenantId: "tenant-1",
      accessEmployeePanel: true,
    });

    await renderCustomerPortal();

    expect(tokenRequestsTo("/api/customer/firebase-token")).toHaveLength(1);
  });

  it("connects the logged-in customer through CustomerRealtimeProviderWrapper", async () => {
    await act(async () => {
      root.render(
        <CustomerRealtimeProviderWrapper>
          <TicketChat />
        </CustomerRealtimeProviderWrapper>,
      );
    });
    await settle();

    expect(tokenRequestsTo("/api/customer/firebase-token")).toHaveLength(1);
    expect(activeListeners(CUSTOMER_CHANNEL)).toHaveLength(1);
  });

  it("shows a ticket chat message that arrives on the customer's own channel", async () => {
    await renderCustomerPortal();
    act(() => syncChannel(CUSTOMER_CHANNEL, []));

    act(() =>
      syncChannel(CUSTOMER_CHANNEL, [
        channelEvent("event-1", {
          type: "ticket.message",
          payload: {
            ticketId: "ticket-1",
            reply: {
              id: "reply-1",
              message: "Sudah kami cek",
              isFromAdmin: true,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      ]),
    );

    expect(container.querySelector("output")?.textContent).toBe("reply-1");
    expect(activeListeners("tickets/ticket-1/events")).toHaveLength(0);
  });

  it("keeps the ticket chat page steady while the ticket is still loading", async () => {
    await renderCustomerPortal();

    for (let render = 0; render < 3; render += 1) {
      await act(async () => {
        root.render(
          <RealtimeProvider
            audience="customer"
            userOverride={CUSTOMER}
            statusOverride="authenticated"
          >
            <LoadingTicketChat ticket={null} />
          </RealtimeProvider>,
        );
      });
    }

    expect(container.querySelector("output")?.textContent).toBe("0");
  });
});
