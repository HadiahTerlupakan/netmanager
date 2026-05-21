import { describe, it, expect, beforeEach, vi } from "vitest";
import { PayScheduleService } from "@/modules/salary-v2/payment/services/PayScheduleService";
import type {
  IPayScheduleRepository,
  PaySchedule,
} from "@/modules/salary-v2/core";

const mockSchedule: PaySchedule = {
  id: "schedule-1",
  tenantId: "tenant-1",
  name: "Bulanan Standar",
  frequency: "MONTHLY",
  cutOffDay: 25,
  cutOffDayOfWeek: null,
  payDay: 28,
  payDayOffset: null,
  gracePeriodDays: 3,
  isDefault: true,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("PayScheduleService", () => {
  let service: PayScheduleService;
  let mockRepo: IPayScheduleRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockSchedule),
      findDefault: vi.fn().mockResolvedValue(mockSchedule),
      findAll: vi.fn().mockResolvedValue([mockSchedule]),
      create: vi.fn().mockResolvedValue(mockSchedule),
      update: vi.fn().mockResolvedValue(mockSchedule),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new PayScheduleService(mockRepo);
  });

  it("should get schedule by id", async () => {
    const result = await service.getById("schedule-1", "tenant-1");
    expect(result).toEqual(mockSchedule);
    expect(mockRepo.findById).toHaveBeenCalledWith("schedule-1", "tenant-1");
  });

  it("should get default schedule", async () => {
    const result = await service.getDefault("tenant-1");
    expect(result).toEqual(mockSchedule);
    expect(mockRepo.findDefault).toHaveBeenCalledWith("tenant-1");
  });

  it("should list all schedules", async () => {
    const result = await service.listAll("tenant-1");
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith("tenant-1");
  });

  it("should create a new schedule", async () => {
    const input = {
      tenantId: "tenant-1",
      name: "Mingguan",
      frequency: "WEEKLY" as const,
      cutOffDay: null as number | null,
      cutOffDayOfWeek: 6,
      payDay: 1,
      payDayOffset: 2,
      gracePeriodDays: 1,
      isDefault: false,
      isActive: true,
    };
    await service.create(input);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("should update a schedule", async () => {
    const data = { name: "Updated Name" };
    await service.update("schedule-1", "tenant-1", data);
    expect(mockRepo.update).toHaveBeenCalledWith(
      "schedule-1",
      "tenant-1",
      data,
    );
  });

  it("should delete a schedule", async () => {
    await service.delete("schedule-1", "tenant-1");
    expect(mockRepo.delete).toHaveBeenCalledWith("schedule-1", "tenant-1");
  });

  describe("generatePeriodDates", () => {
    it("should generate period dates for MONTHLY schedule with cutoff 25", () => {
      const dates = service.generatePeriodDates(mockSchedule, 2026, 5);

      // Period: Apr 26 - May 25, Pay: May 28
      expect(dates.periodStart.getFullYear()).toBe(2026);
      expect(dates.periodStart.getMonth()).toBe(3); // April (0-indexed)
      expect(dates.periodStart.getDate()).toBe(26);
      expect(dates.periodEnd.getMonth()).toBe(4); // May
      expect(dates.periodEnd.getDate()).toBe(25);
      expect(dates.payDate.getMonth()).toBe(4); // May
      expect(dates.payDate.getDate()).toBe(28);
    });

    it("should generate period dates for cutoff day 1", () => {
      const schedule: PaySchedule = {
        ...mockSchedule,
        cutOffDay: 1,
        payDay: 5,
      };
      const dates = service.generatePeriodDates(schedule, 2026, 5);

      // Period: Apr 2 - May 1, Pay: May 5
      expect(dates.periodStart.getMonth()).toBe(3); // April
      expect(dates.periodStart.getDate()).toBe(2);
      expect(dates.periodEnd.getMonth()).toBe(4); // May
      expect(dates.periodEnd.getDate()).toBe(1);
      expect(dates.payDate.getDate()).toBe(5);
    });

    it("should default cutOffDay to 25 when null", () => {
      const schedule: PaySchedule = { ...mockSchedule, cutOffDay: null };
      const dates = service.generatePeriodDates(schedule, 2026, 3);

      // Period: Feb 26 - Mar 25, Pay: Mar 28
      expect(dates.periodStart.getMonth()).toBe(1); // February
      expect(dates.periodStart.getDate()).toBe(26);
      expect(dates.periodEnd.getMonth()).toBe(2); // March
      expect(dates.periodEnd.getDate()).toBe(25);
    });

    it("should handle January (month boundary with previous year)", () => {
      const dates = service.generatePeriodDates(mockSchedule, 2026, 1);

      // Period: Dec 26 2025 - Jan 25 2026, Pay: Jan 28
      expect(dates.periodStart.getFullYear()).toBe(2025);
      expect(dates.periodStart.getMonth()).toBe(11); // December
      expect(dates.periodStart.getDate()).toBe(26);
      expect(dates.periodEnd.getFullYear()).toBe(2026);
      expect(dates.periodEnd.getMonth()).toBe(0); // January
      expect(dates.periodEnd.getDate()).toBe(25);
    });
  });
});
