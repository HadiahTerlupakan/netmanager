import { describe, expect, it } from "vitest";

import {
  useRealtimeEventMock,
  useRealtimeScopeMock,
} from "./realtime-boundary-test-setup";

describe("realtime core hooks", () => {
  it("subscribes work order activity through the realtime scope boundary", async () => {
    const { useRealtimeWorkOrderActivity } =
      await import("@/lib/websocket/hooks/useRealtimeWorkOrderActivity");

    useRealtimeWorkOrderActivity({
      workOrderId: "wo-1",
      initialActivities: [],
    });

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "workorder",
      id: "wo-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.activity",
      expect.any(Function),
    );
  });

  it("listens for ticket chat on the customer's own channel, not the ticket channel", async () => {
    // Token pelanggan tidak membuka kanal tiket; pesan tiket miliknya
    // dikirim juga ke kanal pelanggan itu sendiri.
    const { useRealtimeTicketChat } =
      await import("@/lib/websocket/hooks/useRealtimeTicketChat");

    useRealtimeTicketChat({
      ticketId: "ticket-1",
      initialReplies: [],
    });

    expect(useRealtimeScopeMock).not.toHaveBeenCalled();
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.message",
      expect.any(Function),
    );
  });
});
