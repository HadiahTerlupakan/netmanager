import { describe, expect, it } from "vitest";

import { getCrossSurfaceAttendanceFixture } from "../../fixtures/attendance/crossSurfaceAttendanceFixtures";

describe("AttendanceService cross-surface fixture coverage", () => {
  it("exposes critical attendance fixtures needed by parity tests", () => {
    expect(
      getCrossSurfaceAttendanceFixture("same-day-open-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("same-day-checked-out-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("overnight-shift-still-active"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("stale-flexible-session"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("no-checkout-system-closure"),
    ).toBeDefined();
    expect(
      getCrossSurfaceAttendanceFixture("outside-geofence-warn-accepted"),
    ).toBeDefined();
  });
});
