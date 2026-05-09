import { describe, it, expect } from "vitest";
import {
  buildFixedCheckoutWarning,
  buildShiftCheckoutWarning,
  buildFlexibleCheckoutWarning,
} from "@/modules/attendance/services/attendance-service-helpers";

describe("Checkout Warning Functions", () => {
  const timezone = "Asia/Jakarta";

  describe("buildFixedCheckoutWarning", () => {
    it("should show warning when checkout before schedule end", () => {
      // Checkout at 14:00, schedule end at 17:00
      const checkOutTime = new Date("2026-05-09T07:00:00.000Z"); // 14:00 WIB
      const scheduleEndTime = "17:00";

      const warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime,
        timezone,
      });

      expect(warning).toBeDefined();
      expect(warning).toContain("Jam pulang Anda: 17:00");
      expect(warning).toContain("Checkout sekarang: 14:00");
      expect(warning).toContain("Lebih awal 3 jam 0 menit");
    });

    it("should not show warning when checkout after schedule end", () => {
      // Checkout at 17:00, schedule end at 17:00
      const checkOutTime = new Date("2026-05-09T10:00:00.000Z"); // 17:00 WIB
      const scheduleEndTime = "17:00";

      const warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });

    it("should not show warning when checkout after schedule end (overtime)", () => {
      // Checkout at 19:00, schedule end at 17:00
      const checkOutTime = new Date("2026-05-09T12:00:00.000Z"); // 19:00 WIB
      const scheduleEndTime = "17:00";

      const warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });

    it("should handle checkout 1 minute before schedule end", () => {
      // Checkout at 16:59, schedule end at 17:00
      const checkOutTime = new Date("2026-05-09T09:59:00.000Z"); // 16:59 WIB
      const scheduleEndTime = "17:00";

      const warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime,
        timezone,
      });

      expect(warning).toBeDefined();
      expect(warning).toContain("Lebih awal 0 jam 1 menit");
    });

    it("should return undefined when scheduleEndTime is null", () => {
      const checkOutTime = new Date("2026-05-09T07:00:00.000Z");
      const scheduleEndTime: string | null = null;

      const warning = buildFixedCheckoutWarning({
        checkOutTime,
        scheduleEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });
  });

  describe("buildShiftCheckoutWarning", () => {
    it("should show warning when checkout before shift end", () => {
      // Checkout at 14:00, shift end at 17:00
      const checkOutTime = new Date("2026-05-09T07:00:00.000Z"); // 14:00 WIB
      const shiftEndTime = "17:00";

      const warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime,
        timezone,
      });

      expect(warning).toBeDefined();
      expect(warning).toContain("Shift Anda selesai: 17:00");
      expect(warning).toContain("Checkout sekarang: 14:00");
      expect(warning).toContain("Lebih awal 3 jam 0 menit");
    });

    it("should not show warning when checkout after shift end", () => {
      // Checkout at 17:00, shift end at 17:00
      const checkOutTime = new Date("2026-05-09T10:00:00.000Z"); // 17:00 WIB
      const shiftEndTime = "17:00";

      const warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });

    it("should handle overnight shift correctly", () => {
      // Shift: 21:00 - 04:00
      // Checkout at 02:00 (Day 2), shift end at 04:00 (Day 2)
      const checkOutTime = new Date("2026-05-09T19:00:00.000Z"); // 02:00 WIB Day 2
      const shiftEndTime = "04:00";

      const warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime,
        timezone,
      });

      expect(warning).toBeDefined();
      expect(warning).toContain("Shift Anda selesai: 04:00");
      expect(warning).toContain("Lebih awal 2 jam 0 menit");
    });

    it("should not show warning for overnight shift after shift end", () => {
      // Shift: 21:00 - 04:00
      // Checkout at 04:00 (Day 2), shift end at 04:00 (Day 2)
      const checkOutTime = new Date("2026-05-09T21:00:00.000Z"); // 04:00 WIB Day 2
      const shiftEndTime = "04:00";

      const warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });

    it("should return undefined when shiftEndTime is null", () => {
      const checkOutTime = new Date("2026-05-09T07:00:00.000Z");
      const shiftEndTime: string | null = null;

      const warning = buildShiftCheckoutWarning({
        checkOutTime,
        shiftEndTime,
        timezone,
      });

      expect(warning).toBeUndefined();
    });
  });

  describe("buildFlexibleCheckoutWarning", () => {
    it("should show warning when checkout before target hours", () => {
      // Check-in at 08:00, checkout at 14:00 (6 hours), target 8 hours
      const checkIn = new Date("2026-05-09T01:00:00.000Z"); // 08:00 WIB
      const checkOutTime = new Date("2026-05-09T07:00:00.000Z"); // 14:00 WIB
      const targetHours = 8;

      const warning = buildFlexibleCheckoutWarning({
        checkIn,
        checkOutTime,
        targetHours,
      });

      expect(warning).toBeDefined();
      expect(warning).toContain("Jam kerja Anda baru 6 jam 0 menit");
      expect(warning).toContain("Target kerja: 8 jam");
      expect(warning).toContain("Kurang 2 jam 0 menit");
    });

    it("should not show warning when checkout after target hours", () => {
      // Check-in at 08:00, checkout at 16:00 (8 hours), target 8 hours
      const checkIn = new Date("2026-05-09T01:00:00.000Z"); // 08:00 WIB
      const checkOutTime = new Date("2026-05-09T09:00:00.000Z"); // 16:00 WIB
      const targetHours = 8;

      const warning = buildFlexibleCheckoutWarning({
        checkIn,
        checkOutTime,
        targetHours,
      });

      expect(warning).toBeUndefined();
    });

    it("should not show warning when checkout exceeds target hours", () => {
      // Check-in at 08:00, checkout at 18:00 (10 hours), target 8 hours
      const checkIn = new Date("2026-05-09T01:00:00.000Z"); // 08:00 WIB
      const checkOutTime = new Date("2026-05-09T11:00:00.000Z"); // 18:00 WIB
      const targetHours = 8;

      const warning = buildFlexibleCheckoutWarning({
        checkIn,
        checkOutTime,
        targetHours,
      });

      expect(warning).toBeUndefined();
    });
  });
});
