import { describe, expect, it } from "vitest";

import {
  extractOnlineUserIds,
  matchesRealtimeEvent,
} from "@/lib/realtime/client-utils";

describe("realtime client utils", () => {
  it("matches legacy socket event names against normalized realtime event types", () => {
    expect(
      matchesRealtimeEvent("session:forceLogout", "session.force_logout"),
    ).toBe(true);
    expect(matchesRealtimeEvent("profile:refresh", "profile.refresh")).toBe(
      true,
    );
    expect(matchesRealtimeEvent("announcement:new", "announcement.new")).toBe(
      true,
    );
    expect(
      matchesRealtimeEvent("payment:pending:new", "payment.pending.new"),
    ).toBe(true);
    expect(matchesRealtimeEvent("mikrotik:update", "mikrotik.update")).toBe(
      true,
    );
    expect(matchesRealtimeEvent("ticket:update", "ticket.reply")).toBe(false);
  });

  it("extracts online user ids from presence snapshots", () => {
    expect(
      extractOnlineUserIds({
        "user-1": {
          userId: "user-1",
          isOnline: true,
          source: "web",
          updatedAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T00:00:00.000Z",
        },
        "user-2": {
          userId: "user-2",
          isOnline: false,
          source: "mobile",
          updatedAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T00:00:00.000Z",
        },
        broken: null,
      }),
    ).toEqual(["user-1"]);
  });
});
