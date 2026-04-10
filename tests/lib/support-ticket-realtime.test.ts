import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRealtimeScopeMock, useRealtimeEventMock } = vi.hoisted(() => ({
  useRealtimeScopeMock: vi.fn(),
  useRealtimeEventMock: vi.fn(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: useRealtimeScopeMock,
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: useRealtimeEventMock,
}));

import {
  shouldRefetchSupportTickets,
  useSupportTicketRealtime,
} from "@/lib/websocket/hooks/supportTicketRealtime";

describe("supportTicketRealtime", () => {
  beforeEach(() => {
    useRealtimeScopeMock.mockClear();
    useRealtimeEventMock.mockClear();
  });

  it("subscribes support ticket refreshes through the scoped ticket.message stream", () => {
    const handler = vi.fn();

    useSupportTicketRealtime("ticket-1", handler);

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "ticket",
      id: "ticket-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.message",
      expect.any(Function),
    );

    const onMessage = useRealtimeEventMock.mock.calls[0]?.[1] as
      | ((payload: { ticketId?: string }) => void)
      | undefined;

    expect(onMessage).toBeTypeOf("function");

    onMessage?.({ ticketId: "ticket-2" });
    expect(handler).not.toHaveBeenCalled();

    onMessage?.({ ticketId: "ticket-1" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns true for real reply-bearing support events", () => {
    expect(shouldRefetchSupportTickets("ticket.new")).toBe(true);
    expect(shouldRefetchSupportTickets("ticket.reply")).toBe(true);
    expect(shouldRefetchSupportTickets("ticket.message")).toBe(true);
  });

  it("returns false for unrelated support events", () => {
    expect(shouldRefetchSupportTickets("ticket.update")).toBe(false);
    expect(shouldRefetchSupportTickets("ticket.count")).toBe(false);
    expect(shouldRefetchSupportTickets("notification.new")).toBe(false);
  });
});
