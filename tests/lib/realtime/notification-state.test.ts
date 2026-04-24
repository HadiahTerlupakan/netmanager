import { describe, expect, it } from "vitest";
import { addUnreadRealtimeNotification } from "@/lib/realtime/notification-state";

const existingNotification = {
  id: "notif-1",
  type: "SYSTEM",
  priority: "HIGH",
  title: "Existing",
  message: "Existing message",
  isRead: false,
  createdAt: "2026-04-25T00:00:00.000Z",
};

const duplicatePayload = {
  id: "notif-1",
  type: "SYSTEM",
  priority: "HIGH",
  title: "Existing",
  message: "Existing message",
  createdAt: "2026-04-25T00:00:00.000Z",
};

describe("notification realtime state", () => {
  it("does not add or count a realtime notification that is already present", () => {
    const result = addUnreadRealtimeNotification(
      [existingNotification],
      duplicatePayload,
      5,
    );

    expect(result.didAdd).toBe(false);
    expect(result.notifications).toEqual([existingNotification]);
  });
});
