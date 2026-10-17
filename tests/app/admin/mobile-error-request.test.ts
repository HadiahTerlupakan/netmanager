import { describe, expect, it } from "vitest";

import {
  describeMobileErrorRequest,
  formatMobileErrorRequest,
} from "@/app/admin/log/mobile-errors/mobile-error-request";

describe("describeMobileErrorRequest", () => {
  it("membaca endpoint, status, dan pesan server dari context.extra", () => {
    const details = {
      context: {
        extra: {
          method: "POST",
          endpoint: "/api/mobile/attendance/check-in",
          status: 400,
          serverMessage: "Check-in terlalu awal",
        },
      },
    };

    expect(describeMobileErrorRequest(details)).toEqual({
      method: "POST",
      endpoint: "/api/mobile/attendance/check-in",
      status: 400,
      serverMessage: "Check-in terlalu awal",
    });
  });

  it("tetap membaca endpoint dari laporan lama tanpa status", () => {
    const details = {
      context: { extra: { method: "POST", endpoint: "/api/mobile/x" } },
    };
    expect(describeMobileErrorRequest(details)).toEqual({
      method: "POST",
      endpoint: "/api/mobile/x",
    });
  });

  it("mengembalikan null bila laporan tidak membawa info request", () => {
    expect(describeMobileErrorRequest({})).toBeNull();
    expect(describeMobileErrorRequest({ context: { extra: "x" } })).toBeNull();
  });
});

describe("formatMobileErrorRequest", () => {
  it("menyusun satu baris ringkas", () => {
    expect(
      formatMobileErrorRequest({
        method: "POST",
        endpoint: "/api/mobile/attendance/check-in",
        status: 400,
      }),
    ).toBe("POST /api/mobile/attendance/check-in · 400");
  });
});
