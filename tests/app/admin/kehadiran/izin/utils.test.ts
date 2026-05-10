import { describe, it, expect } from "vitest";
import {
  transformLeaveToCalendarEvent,
  detectLeaveConflicts,
  getLeaveTypeLabel,
  getLeaveStatusColor,
  formatDateRange,
} from "@/app/admin/kehadiran/izin/utils";
import type { LeaveCalendarEvent } from "@/app/admin/kehadiran/izin/types";

describe("Leave Calendar Utils", () => {
  describe("transformLeaveToCalendarEvent", () => {
    it("should transform leave data to calendar event format", () => {
      const leave = {
        id: "leave-1",
        userId: "user-1",
        type: "CUTI" as const,
        startDate: "2026-05-15",
        endDate: "2026-05-17",
        status: "APPROVED" as const,
        reason: "Liburan keluarga",
        user: {
          name: "John Doe",
        },
      };

      const event = transformLeaveToCalendarEvent(leave);

      expect(event.id).toBe("leave-1");
      expect(event.title).toBe("John Doe - Cuti");
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
      expect(event.resource.userId).toBe("user-1");
      expect(event.resource.type).toBe("CUTI");
      expect(event.resource.status).toBe("APPROVED");
      expect(event.resource.reason).toBe("Liburan keluarga");
    });

    it("should handle Date objects as input", () => {
      const leave = {
        id: "leave-2",
        userId: "user-2",
        type: "SAKIT" as const,
        startDate: new Date("2026-05-20"),
        endDate: new Date("2026-05-21"),
        status: "PENDING" as const,
        reason: "Demam",
        user: {
          name: "Jane Smith",
        },
      };

      const event = transformLeaveToCalendarEvent(leave);

      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
    });

    it("should handle null reason", () => {
      const leave = {
        id: "leave-3",
        userId: "user-3",
        type: "IZIN" as const,
        startDate: "2026-05-25",
        endDate: "2026-05-25",
        status: "REJECTED" as const,
        reason: null as string | null,
        user: {
          name: "Bob Wilson",
        },
      };

      const event = transformLeaveToCalendarEvent(leave);

      expect(event.resource.reason).toBeUndefined();
    });
  });

  describe("detectLeaveConflicts", () => {
    it("should detect overlapping leaves for same user", () => {
      const events: LeaveCalendarEvent[] = [
        {
          id: "leave-1",
          title: "User A - Cuti",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-17"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "CUTI",
            status: "APPROVED",
          },
        },
        {
          id: "leave-2",
          title: "User A - Sakit",
          start: new Date("2026-05-16"),
          end: new Date("2026-05-18"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "SAKIT",
            status: "PENDING",
          },
        },
      ];

      const conflicts = detectLeaveConflicts(events);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].leaveId).toBe("leave-1");
      expect(conflicts[0].conflictingLeaveIds).toContain("leave-2");
      expect(conflicts[0].userId).toBe("user-1");
    });

    it("should not detect conflicts for different users", () => {
      const events: LeaveCalendarEvent[] = [
        {
          id: "leave-1",
          title: "User A - Cuti",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-17"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "CUTI",
            status: "APPROVED",
          },
        },
        {
          id: "leave-2",
          title: "User B - Cuti",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-17"),
          resource: {
            userId: "user-2",
            userName: "User B",
            type: "CUTI",
            status: "APPROVED",
          },
        },
      ];

      const conflicts = detectLeaveConflicts(events);

      expect(conflicts).toHaveLength(0);
    });

    it("should not detect conflicts for non-overlapping dates", () => {
      const events: LeaveCalendarEvent[] = [
        {
          id: "leave-1",
          title: "User A - Cuti",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-17"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "CUTI",
            status: "APPROVED",
          },
        },
        {
          id: "leave-2",
          title: "User A - Sakit",
          start: new Date("2026-05-20"),
          end: new Date("2026-05-22"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "SAKIT",
            status: "PENDING",
          },
        },
      ];

      const conflicts = detectLeaveConflicts(events);

      expect(conflicts).toHaveLength(0);
    });

    it("should detect edge case: same start and end date", () => {
      const events: LeaveCalendarEvent[] = [
        {
          id: "leave-1",
          title: "User A - Cuti",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-15"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "CUTI",
            status: "APPROVED",
          },
        },
        {
          id: "leave-2",
          title: "User A - Sakit",
          start: new Date("2026-05-15"),
          end: new Date("2026-05-15"),
          resource: {
            userId: "user-1",
            userName: "User A",
            type: "SAKIT",
            status: "PENDING",
          },
        },
      ];

      const conflicts = detectLeaveConflicts(events);

      expect(conflicts).toHaveLength(1);
    });
  });

  describe("getLeaveTypeLabel", () => {
    it("should return correct labels for all leave types", () => {
      expect(getLeaveTypeLabel("CUTI")).toBe("Cuti");
      expect(getLeaveTypeLabel("SAKIT")).toBe("Sakit");
      expect(getLeaveTypeLabel("IZIN")).toBe("Izin");
      expect(getLeaveTypeLabel("LAINNYA")).toBe("Lainnya");
      expect(getLeaveTypeLabel("TUKAR_LIBUR")).toBe("Tukar Libur");
    });
  });

  describe("getLeaveStatusColor", () => {
    it("should return correct colors for all statuses", () => {
      expect(getLeaveStatusColor("PENDING")).toBe("#f59e0b");
      expect(getLeaveStatusColor("APPROVED")).toBe("#10b981");
      expect(getLeaveStatusColor("REJECTED")).toBe("#ef4444");
    });
  });

  describe("formatDateRange", () => {
    it("should format single day correctly", () => {
      const date = new Date("2026-05-15");
      const result = formatDateRange(date, date);

      expect(result).toBe("15 Mei 2026");
    });

    it("should format date range correctly", () => {
      const start = new Date("2026-05-15");
      const end = new Date("2026-05-17");
      const result = formatDateRange(start, end);

      expect(result).toBe("15 Mei 2026 - 17 Mei 2026");
    });
  });
});
