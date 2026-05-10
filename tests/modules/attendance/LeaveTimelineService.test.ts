import { describe, it, expect, beforeEach } from "vitest";
import { LeaveTimelineService } from "@/modules/attendance/services/LeaveTimelineService";
import type { TimelineSettings } from "@/modules/attendance/services/LeaveTimelineService";
import { addHours } from "date-fns";

describe("LeaveTimelineService", () => {
  let service: LeaveTimelineService;

  const defaultSettings: TimelineSettings = {
    enableTimelineAutoReject: true,
    mendadakDeadlineHours: 8,
    mendadakReminder1Hours: 4,
    mendadakReminder2Hours: 6,
    normalDeadlineDays: 1,
    normalReminder1Days: 3,
    normalReminder2Days: 2,
    advanceDeadlineDays: 1,
    advanceReminder1Days: 7,
    advanceReminder2Days: 3,
    advanceReminder3Days: 1,
  };

  beforeEach(() => {
    service = new LeaveTimelineService();
  });

  describe("determineCategory", () => {
    it("should return 'mendadak' if start date is < 24 hours from submit", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-01T20:00:00"); // 11 hours later

      const category = service.determineCategory(submittedAt, startDate);

      expect(category).toBe("mendadak");
    });

    it("should return 'normal' if start date is 1-7 days from submit", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-04T09:00:00"); // 3 days later

      const category = service.determineCategory(submittedAt, startDate);

      expect(category).toBe("normal");
    });

    it("should return 'advance' if start date is > 7 days from submit", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-15T09:00:00"); // 14 days later

      const category = service.determineCategory(submittedAt, startDate);

      expect(category).toBe("advance");
    });
  });

  describe("calculateDeadline", () => {
    it("should calculate mendadak deadline as submittedAt + X hours", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-02T09:00:00"); // Next day

      const deadline = service.calculateDeadline(
        "mendadak",
        submittedAt,
        startDate,
        defaultSettings,
      );

      const expected = addHours(submittedAt, 8);
      expect(deadline.getTime()).toBe(expected.getTime());
    });

    it("should calculate mendadak deadline as H-1 17:00 if earlier than submittedAt + X hours", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-01T18:00:00"); // Same day, 9 hours later

      const deadline = service.calculateDeadline(
        "mendadak",
        submittedAt,
        startDate,
        defaultSettings,
      );

      // H-1 17:00 would be May 31 17:00, which is before submittedAt (June 1 09:00)
      // So should use the earlier one which is May 31 17:00
      expect(deadline.getDate()).toBe(31);
      expect(deadline.getMonth()).toBe(4); // May (0-indexed)
      expect(deadline.getHours()).toBe(17);
    });

    it("should calculate normal deadline as H-1 17:00", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00"); // 4 days later

      const deadline = service.calculateDeadline(
        "normal",
        submittedAt,
        startDate,
        defaultSettings,
      );

      // H-1 = June 4, 17:00
      expect(deadline.getDate()).toBe(4);
      expect(deadline.getHours()).toBe(17);
      expect(deadline.getMinutes()).toBe(0);
    });

    it("should calculate advance deadline as H-1 17:00", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-15T09:00:00"); // 14 days later

      const deadline = service.calculateDeadline(
        "advance",
        submittedAt,
        startDate,
        defaultSettings,
      );

      // H-1 = June 14, 17:00
      expect(deadline.getDate()).toBe(14);
      expect(deadline.getHours()).toBe(17);
      expect(deadline.getMinutes()).toBe(0);
    });
  });

  describe("determineReminders", () => {
    it("should return 2 reminders for mendadak category", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-01T20:00:00");

      const reminders = service.determineReminders(
        "mendadak",
        submittedAt,
        startDate,
        defaultSettings,
      );

      expect(reminders).toHaveLength(2);
      expect(reminders[0].getTime()).toBe(addHours(submittedAt, 4).getTime());
      expect(reminders[1].getTime()).toBe(addHours(submittedAt, 6).getTime());
    });

    it("should return 2 reminders for normal category", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");

      const reminders = service.determineReminders(
        "normal",
        submittedAt,
        startDate,
        defaultSettings,
      );

      expect(reminders).toHaveLength(2);
      // H-3 at 09:00
      expect(reminders[0].getDate()).toBe(2);
      expect(reminders[0].getHours()).toBe(9);
      // H-2 at 09:00
      expect(reminders[1].getDate()).toBe(3);
      expect(reminders[1].getHours()).toBe(9);
    });

    it("should return 3 reminders for advance category", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-15T09:00:00");

      const reminders = service.determineReminders(
        "advance",
        submittedAt,
        startDate,
        defaultSettings,
      );

      expect(reminders).toHaveLength(3);
      // H-7 at 09:00
      expect(reminders[0].getDate()).toBe(8);
      // H-3 at 09:00
      expect(reminders[1].getDate()).toBe(12);
      // H-1 at 09:00
      expect(reminders[2].getDate()).toBe(14);
    });
  });

  describe("checkShouldAutoReject", () => {
    it("should return false if timeline auto-reject is disabled", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-05T18:00:00"); // Past deadline

      const settings = { ...defaultSettings, enableTimelineAutoReject: false };

      const shouldReject = service.checkShouldAutoReject(
        submittedAt,
        startDate,
        now,
        settings,
      );

      expect(shouldReject).toBe(false);
    });

    it("should return true if now is past deadline", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-04T18:00:00"); // Past H-1 17:00

      const shouldReject = service.checkShouldAutoReject(
        submittedAt,
        startDate,
        now,
        defaultSettings,
      );

      expect(shouldReject).toBe(true);
    });

    it("should return false if now is before deadline", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-04T16:00:00"); // Before H-1 17:00

      const shouldReject = service.checkShouldAutoReject(
        submittedAt,
        startDate,
        now,
        defaultSettings,
      );

      expect(shouldReject).toBe(false);
    });
  });

  describe("determineReminderStage", () => {
    it("should return 'first' if first reminder time has passed and not sent yet", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-02T10:00:00"); // Past H-3 09:00

      const stage = service.determineReminderStage(
        submittedAt,
        startDate,
        now,
        null,
        null,
        null,
        defaultSettings,
      );

      expect(stage).toBe("first");
    });

    it("should return 'second' if second reminder time has passed and not sent yet", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-03T10:00:00"); // Past H-2 09:00

      const stage = service.determineReminderStage(
        submittedAt,
        startDate,
        now,
        new Date("2026-06-02T10:00:00"), // First already sent
        null,
        null,
        defaultSettings,
      );

      expect(stage).toBe("second");
    });

    it("should return 'final' for normal category when second reminder time has passed", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-03T10:00:00"); // Past H-2 09:00

      const stage = service.determineReminderStage(
        submittedAt,
        startDate,
        now,
        new Date("2026-06-02T10:00:00"), // First already sent
        new Date("2026-06-03T10:00:00"), // Second already sent
        null,
        defaultSettings,
      );

      expect(stage).toBe("final");
    });

    it("should return null if no reminder is due", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-02T08:00:00"); // Before H-3 09:00

      const stage = service.determineReminderStage(
        submittedAt,
        startDate,
        now,
        null,
        null,
        null,
        defaultSettings,
      );

      expect(stage).toBe(null);
    });

    it("should return null if all reminders already sent", () => {
      const submittedAt = new Date("2026-06-01T09:00:00");
      const startDate = new Date("2026-06-05T09:00:00");
      const now = new Date("2026-06-04T10:00:00");

      const stage = service.determineReminderStage(
        submittedAt,
        startDate,
        now,
        new Date("2026-06-02T10:00:00"),
        new Date("2026-06-03T10:00:00"),
        new Date("2026-06-03T10:00:00"),
        defaultSettings,
      );

      expect(stage).toBe(null);
    });
  });
});
