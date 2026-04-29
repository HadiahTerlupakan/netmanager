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

  it("subscribes ticket chat through the realtime scope boundary", async () => {
    const { useRealtimeTicketChat } =
      await import("@/lib/websocket/hooks/useRealtimeTicketChat");

    useRealtimeTicketChat({
      ticketId: "ticket-1",
      initialReplies: [],
    });

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "ticket",
      id: "ticket-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.message",
      expect.any(Function),
    );
  });
});
