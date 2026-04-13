import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "../../setup";
import { SalaryCalculatorService } from "@/modules/salary/services/SalaryCalculatorService";
import type { UserCalculationData } from "@/modules/salary/services/SalaryCalculatorService";

const baseUser: UserCalculationData = {
  id: "user-1",
  name: "User One",
  basicSalary: 3_000_000,
  employeeType: "KARYAWAN",
  departmentId: null,
  siteId: null,
  payPeriodDay: 25,
  payDay: 30,
  woIncentiveEnabled: false,
  woIncentiveRate: null,
  lateDeductionRate: 25_000,
  absentDeductionRate: null,
  overtimeRateNormal: 20_000,
  overtimeRateHoliday: 30_000,
  overtimeRateNational: 40_000,
  overtimeCalcTypeNormal: "PER_HOUR",
  overtimeCalcTypeHoliday: "PER_HOUR",
  overtimeCalcTypeNational: "PER_HOUR",
  workDays: "Senin,Selasa,Rabu,Kamis,Jumat",
  joinDate: null,
  ptkpStatus: null,
  bpjsKesehatan: false,
  bpjsKetenagakerjaan: false,
};

describe("SalaryCalculatorService canonical evaluation parity", () => {
  let service: SalaryCalculatorService;

  beforeEach(() => {
    service = new SalaryCalculatorService();
    prismaMock.userSalaryComponent.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue({
      workDays: "Senin,Selasa,Rabu,Kamis,Jumat",
    });
    prismaMock.workOrders.count.mockResolvedValue(0);
    prismaMock.employeeLoan.findMany.mockResolvedValue([]);
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.overtime.findMany.mockResolvedValue([]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValue([]);
  });

  it("uses canonical ABSENT final status instead of raw attendance status for alpha deduction", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        status: "ON_TIME",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        checkOut: new Date("2026-04-01T09:00:00.000Z"),
      },
    ]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "ABSENT",
        overtimeMinutesApproved: 0,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: null,
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Potongan Alpha / Unpaid",
          quantity: 1,
        }),
      ]),
    );
  });

  it("uses canonical PERMIT final status instead of raw attendance absence for unpaid deduction", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        status: "ABSENT",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        checkOut: null,
      },
    ]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "PERMIT",
        overtimeMinutesApproved: 0,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: null,
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.deductions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Potongan Alpha / Unpaid" }),
      ]),
    );
    expect(result.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Izin",
          quantity: 1,
        }),
      ]),
    );
  });

  it("merges canonical attendance status per workDate with raw attendance fallback for days without evaluation", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        status: "ABSENT",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        checkOut: null,
      },
      {
        status: "ABSENT",
        checkIn: new Date("2026-04-02T01:00:00.000Z"),
        checkOut: null,
      },
    ]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "PERMIT",
        overtimeMinutesApproved: 0,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: null,
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Potongan Alpha / Unpaid",
          quantity: 1,
        }),
      ]),
    );
    expect(result.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Izin",
          quantity: 1,
        }),
      ]),
    );
  });

  it("uses canonical approved overtime minutes and ignores held overtime minutes in salary overtime pay", async () => {
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        overtimeMinutesApproved: 120,
        overtimeMinutesHeld: 180,
        payrollHoldState: "OVERTIME_HELD",
        holidayState: "LIBUR_NASIONAL",
      },
    ]);
    prismaMock.overtime.findMany.mockResolvedValueOnce([
      {
        duration: 300,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        startTime: new Date("2026-04-01T18:00:00.000Z"),
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Lembur",
          quantity: 2,
          amount: 80_000,
          notes: "Total 2.0 jam",
        }),
      ]),
    );
  });

  it("matches canonical overtime evaluations by workDate instead of evaluation fetch order", async () => {
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-01T00:00:00.000Z"),
        finalStatus: "ON_TIME",
        overtimeMinutesApproved: 60,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: null,
      },
      {
        workDate: new Date("2026-04-02T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        overtimeMinutesApproved: 120,
        overtimeMinutesHeld: 0,
        payrollHoldState: "NONE",
        holidayState: "LIBUR_NASIONAL",
      },
    ]);
    prismaMock.overtime.findMany.mockResolvedValueOnce([
      {
        duration: 300,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        startTime: new Date("2026-04-02T18:00:00.000Z"),
        createdAt: new Date("2026-04-02T12:00:00.000Z"),
      },
      {
        duration: 300,
        isHolidayOvertime: false,
        isNationalHoliday: false,
        startTime: new Date("2026-04-01T18:00:00.000Z"),
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Lembur",
          quantity: 3,
          amount: 100_000,
          notes: "Total 3.0 jam",
        }),
      ]),
    );
  });

  it("applies canonical approved overtime minutes once per workDate even when multiple raw overtime rows exist", async () => {
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-02T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        overtimeMinutesApproved: 120,
        overtimeMinutesHeld: 60,
        payrollHoldState: "OVERTIME_HELD",
        holidayState: "LIBUR_NASIONAL",
      },
    ]);
    prismaMock.overtime.findMany.mockResolvedValueOnce([
      {
        duration: 180,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        startTime: new Date("2026-04-02T10:00:00.000Z"),
        createdAt: new Date("2026-04-02T09:00:00.000Z"),
      },
      {
        duration: 120,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        startTime: new Date("2026-04-02T18:00:00.000Z"),
        createdAt: new Date("2026-04-02T17:00:00.000Z"),
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Lembur",
          quantity: 2,
          amount: 80_000,
          notes: "Total 2.0 jam",
        }),
      ]),
    );
  });

  it("does not fall back to raw overtime duration when canonical evaluation exists with zero approved minutes", async () => {
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([
      {
        workDate: new Date("2026-04-02T00:00:00.000Z"),
        finalStatus: "DAY_OFF",
        overtimeMinutesApproved: 0,
        overtimeMinutesHeld: 180,
        payrollHoldState: "OVERTIME_HELD",
        holidayState: "LIBUR_NASIONAL",
      },
    ]);
    prismaMock.overtime.findMany.mockResolvedValueOnce([
      {
        duration: 180,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        startTime: new Date("2026-04-02T10:00:00.000Z"),
        createdAt: new Date("2026-04-02T09:00:00.000Z"),
      },
    ]);

    const result = await service.calculateSalary("user-1", 4, 2026, baseUser);

    expect(prismaMock.attendanceEvaluation.findMany).toHaveBeenCalled();
    expect(result.earnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Lembur" })]),
    );
  });
});
