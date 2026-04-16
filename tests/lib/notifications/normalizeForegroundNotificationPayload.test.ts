import { describe, expect, it } from "vitest";
import { normalizeForegroundNotificationPayload } from "@/lib/notifications/normalizeForegroundNotificationPayload";

describe("normalizeForegroundNotificationPayload", () => {
  it("prefers notification copy when notification fields are present", () => {
    expect(
      normalizeForegroundNotificationPayload({
        notification: {
          title: "Admin Alert",
          body: "Ticket baru masuk",
        },
        data: {
          title: "Ignored Title",
          body: "Ignored Body",
        },
      }),
    ).toEqual({
      title: "Admin Alert",
      body: "Ticket baru masuk",
    });
  });

  it("falls back to data-only payloads for admin foreground delivery", () => {
    expect(
      normalizeForegroundNotificationPayload({
        data: {
          title: "Work Order Baru",
          body: "WO-2026-001 menunggu tindak lanjut",
        },
      }),
    ).toEqual({
      title: "Work Order Baru",
      body: "WO-2026-001 menunggu tindak lanjut",
    });
  });

  it("uses data.message as a body fallback when data.body is absent", () => {
    expect(
      normalizeForegroundNotificationPayload({
        data: {
          title: "Pesan Sistem",
          message: "Ada pembaruan tugas baru",
        },
      }),
    ).toEqual({
      title: "Pesan Sistem",
      body: "Ada pembaruan tugas baru",
    });
  });

  it("returns null when title or body is missing", () => {
    expect(
      normalizeForegroundNotificationPayload({
        data: {
          title: "Title without body",
        },
      }),
    ).toBeNull();
  });
});
