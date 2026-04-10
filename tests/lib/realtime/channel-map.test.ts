import { describe, expect, it } from "vitest";
import {
  buildPresencePath,
  buildScopeChannel,
  buildScopeConsumerPath,
  getEventSubscriptionNames,
  LEGACY_TO_REALTIME_EVENT,
} from "@/lib/realtime/channel-map";

describe("realtime channel mapping", () => {
  it("maps scope targets to deterministic Firebase paths", () => {
    expect(buildScopeChannel({ kind: "user", id: "user-1" })).toBe(
      "users/user-1/events",
    );
    expect(buildScopeChannel({ kind: "department", id: "dep-1" })).toBe(
      "departments/dep-1/events",
    );
    expect(buildScopeChannel({ kind: "workorder", id: "wo-1" })).toBe(
      "workorders/wo-1/events",
    );
    expect(buildScopeChannel({ kind: "ticket", id: "ticket-1" })).toBe(
      "tickets/ticket-1/events",
    );
    expect(buildScopeChannel({ kind: "admin", id: "notifications" })).toBe(
      "admin/streams/notifications/events",
    );
    expect(buildPresencePath("user-1")).toBe("presence/users/user-1");
    expect(
      buildScopeConsumerPath({ kind: "admin", id: "mikrotik" }, "user-1"),
    ).toBe("presence/scopes/admin%3Amikrotik/consumers/user-1");
  });

  it("normalizes legacy Socket.IO names into the Firebase event contract", () => {
    expect(LEGACY_TO_REALTIME_EVENT["notification:new"]).toBe(
      "notification.new",
    );
    expect(LEGACY_TO_REALTIME_EVENT["workorder:update"]).toBe(
      "workorder.update",
    );
    expect(LEGACY_TO_REALTIME_EVENT["profile:refresh"]).toBe("profile.refresh");
    expect(LEGACY_TO_REALTIME_EVENT["session:forceLogout"]).toBe(
      "session.force_logout",
    );
    expect(LEGACY_TO_REALTIME_EVENT["chat:message"]).toBe("chat.message");
    expect(LEGACY_TO_REALTIME_EVENT["announcement:new"]).toBe(
      "announcement.new",
    );
    expect(LEGACY_TO_REALTIME_EVENT["ticket:reply"]).toBe("ticket.reply");
    expect(LEGACY_TO_REALTIME_EVENT["payment:pending:new"]).toBe(
      "payment.pending.new",
    );
    expect(LEGACY_TO_REALTIME_EVENT["mikrotik:update"]).toBe("mikrotik.update");
    expect(LEGACY_TO_REALTIME_EVENT["radius:stats"]).toBe("radius.stats");
    expect(LEGACY_TO_REALTIME_EVENT["radius:sessions"]).toBe("radius.sessions");
  });

  it("returns canonical subscription names plus all mapped legacy aliases", () => {
    expect(getEventSubscriptionNames("notification.new")).toEqual([
      "notification.new",
      "notification:new",
    ]);
    expect(getEventSubscriptionNames("payment.pending.new")).toEqual([
      "payment.pending.new",
      "payment:pending_new",
      "payment:pending:new",
    ]);
    expect(getEventSubscriptionNames("unknown.event")).toEqual([
      "unknown.event",
    ]);
  });
});
