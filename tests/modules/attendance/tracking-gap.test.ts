import { describe, expect, it } from "vitest";

import {
  evaluateTracking,
  sumTrackingOffMs,
} from "@/modules/attendance/services/tracking-gap";

const at = (time: string) => new Date(`2026-10-18T${time}:00.000Z`);
const MINUTE = 60 * 1000;

describe("evaluateTracking", () => {
  it("treats a fresh session without points as still starting", () => {
    expect(
      evaluateTracking({
        checkIn: at("01:00"),
        lastPointAt: null,
        reportedStatus: null,
        reportedAt: null,
        now: at("01:30"),
      }).isOff,
    ).toBe(false);
  });

  it("flags a session that never sent a point once the gap has passed", () => {
    expect(
      evaluateTracking({
        checkIn: at("01:00"),
        lastPointAt: null,
        reportedStatus: null,
        reportedAt: null,
        now: at("02:00"),
      }),
    ).toEqual({ isOff: true, offSince: at("01:00"), reason: "NO_POINT" });
  });

  it("flags a session whose last point is older than the gap", () => {
    expect(
      evaluateTracking({
        checkIn: at("01:00"),
        lastPointAt: at("02:00"),
        reportedStatus: "ACTIVE",
        reportedAt: at("01:00"),
        now: at("03:00"),
      }),
    ).toEqual({ isOff: true, offSince: at("02:00"), reason: "STALE" });
  });

  it("flags at once a session whose app reported the permission revoked", () => {
    expect(
      evaluateTracking({
        checkIn: at("01:00"),
        lastPointAt: at("02:00"),
        reportedStatus: "BACKGROUND_DENIED",
        reportedAt: at("02:05"),
        now: at("02:10"),
      }),
    ).toEqual({
      isOff: true,
      offSince: at("02:00"),
      reason: "BACKGROUND_DENIED",
    });
  });

  it("trusts a point that arrived after the app's problem report", () => {
    expect(
      evaluateTracking({
        checkIn: at("01:00"),
        lastPointAt: at("02:20"),
        reportedStatus: "GPS_OFF",
        reportedAt: at("02:05"),
        now: at("02:30"),
      }).isOff,
    ).toBe(false);
  });
});

describe("sumTrackingOffMs", () => {
  it("counts every silence longer than the gap, including the open end", () => {
    const off = sumTrackingOffMs({
      start: at("01:00"),
      end: at("06:00"),
      points: [at("01:05"), at("01:35"), at("03:35"), at("04:00")],
    });

    // 01:35→03:35 (2 jam) dan 04:00→06:00 (2 jam).
    expect(off).toBe(240 * MINUTE);
  });

  it("counts the whole session when no point was ever sent", () => {
    expect(
      sumTrackingOffMs({ start: at("01:00"), end: at("03:00"), points: [] }),
    ).toBe(120 * MINUTE);
  });

  it("ignores points outside the session", () => {
    expect(
      sumTrackingOffMs({
        start: at("01:00"),
        end: at("02:00"),
        points: [at("00:10"), at("01:30"), at("05:00")],
      }),
    ).toBe(0);
  });
});
