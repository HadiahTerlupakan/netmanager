import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import type { SalaryWithDetailsEntity } from "@/modules/salary/domain/entities/SalaryEntity";
import type { SalaryWithRelations } from "@/modules/salary/mappers/SalaryMapper.helpers";
import type { SalaryFilters } from "@/modules/salary/domain/ports/ISalaryRepository";
import type { UserCalculationData } from "@/modules/salary/services/SalaryCalculatorService";

describe("salary helper wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("SalaryService.calculateSingle delegates to SalaryService.commands", async () => {
    const calculateSingleSalary = vi.fn().mockResolvedValue({
      success: true,
      data: { salaryId: "salary-123" },
    });

    vi.doMock("@/modules/salary/services/SalaryService.commands", () => ({
      calculateSingleSalary,
      calculateBulkSalary: vi.fn(),
      approveSalaryCommand: vi.fn(),
      markSalaryAsPaid: vi.fn(),
      auditSalaryCommand: vi.fn(),
      recalculateSalaryCommand: vi.fn(),
      deleteSalaryCommand: vi.fn(),
      updateSalaryCommand: vi.fn(),
      addSalaryAdjustment: vi.fn(),
      requestSalaryRevision: vi.fn(),
    }));

    const { SalaryService } =
      await import("@/modules/salary/services/SalaryService");

    const service = new SalaryService();
    const result = await service.calculateSingle("user-1", 4, 2026, "actor-1");

    expect(calculateSingleSalary).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.any(Object),
        calculationCommandService: expect.any(Object),
        auditService: expect.any(Object),
        workflowService: expect.any(Object),
      }),
      {
        userId: "user-1",
        month: 4,
        year: 2026,
        calculatedById: "actor-1",
      },
    );
    expect(result).toEqual({ success: true, data: { salaryId: "salary-123" } });
  });

  it("SalaryRepository.findAll and updateStatus use repository helpers", async () => {
    const buildSalaryWhere = vi.fn().mockReturnValue({ status: "AUDITED" });
    const buildSalaryFullInclude = vi.fn().mockReturnValue({ user: true });
    const buildSalaryStatusUpdate = vi.fn().mockReturnValue({ status: "PAID" });

    vi.doMock("@/modules/salary/repositories/SalaryRepository.helpers", () => ({
      buildSalaryWhere,
      buildSalaryFullInclude,
      buildSalaryStatusUpdate,
    }));

    prismaMock.salary.findMany.mockResolvedValueOnce([]);
    prismaMock.salary.count.mockResolvedValueOnce(0);
    prismaMock.salary.update.mockResolvedValueOnce({
      id: "salary-1",
      userId: "user-1",
      month: 4,
      year: 2026,
      status: "PAID",
      basicSalary: 1000000,
      totalEarnings: 1000000,
      totalDeductions: 0,
      netSalary: 1000000,
      auditNotes: null,
      calculatedAt: null,
      auditedAt: null,
      approvedAt: null,
      paidAt: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const { SalaryRepository } =
      await import("@/modules/salary/repositories/SalaryRepository");

    const repository = new SalaryRepository();
    const filters: SalaryFilters = { status: "AUDITED", take: 5, skip: 0 };
    await repository.findAll(filters);
    await repository.updateStatus("salary-1", "PAID", "actor-1", "done");

    expect(buildSalaryWhere).toHaveBeenCalledWith(filters);
    expect(buildSalaryFullInclude).toHaveBeenCalled();
    expect(buildSalaryStatusUpdate).toHaveBeenCalledWith(
      "PAID",
      "actor-1",
      "done",
    );
  });

  it("SalaryMapper helpers route DTO mapping through SalaryMapper.dto", async () => {
    const baseEntity: SalaryWithDetailsEntity = {
      id: "salary-1",
      userId: "user-1",
      month: 4,
      year: 2026,
      status: "CALCULATED",
      basicSalary: 1000000,
      totalEarnings: 1200000,
      totalDeductions: 200000,
      netSalary: 1000000,
      auditNotes: null,
      calculatedAt: null,
      auditedAt: null,
      approvedAt: null,
      paidAt: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      user: {
        id: "user-1",
        name: "User One",
        email: "user@example.com",
        employeeType: "KARYAWAN",
        departmentId: null,
        siteId: null,
        departments: null,
        sites: null,
      },
      details: [],
      revisions: [],
      auditedBy: null,
      approvedBy: null,
    };

    const toSalaryListItemDTO = vi.fn().mockReturnValue({ marker: "list" });
    const toSalaryDetailDTO = vi.fn().mockReturnValue({ marker: "detail" });
    const toSalarySlipDTO = vi.fn().mockReturnValue({ marker: "slip" });

    vi.doMock("@/modules/salary/mappers/SalaryMapper.dto", () => ({
      toSalaryListItemDTO,
      toSalaryDetailDTO,
      toSalarySlipDTO,
    }));

    const mapperHelpers =
      await import("@/modules/salary/mappers/SalaryMapper.helpers");

    expect(mapperHelpers.toSalaryListItemDTO(baseEntity)).toEqual({
      marker: "list",
    });
    expect(mapperHelpers.toSalaryDetailDTO(baseEntity)).toEqual({
      marker: "detail",
    });
    expect(mapperHelpers.toSalarySlipDTO(baseEntity)).toEqual({
      marker: "slip",
    });
    expect(toSalaryListItemDTO).toHaveBeenCalledWith(baseEntity);
    expect(toSalaryDetailDTO).toHaveBeenCalledWith(baseEntity);
    expect(toSalarySlipDTO).toHaveBeenCalledWith(baseEntity);
  });

  it("SalaryCalculatorService uses active loan deduction helper output", async () => {
    const buildActiveLoanDeductionLines = vi.fn().mockReturnValue([
      {
        name: "Loan Helper",
        amount: 777,
        loanId: "loan-1",
        notes: "from helper",
      },
    ]);

    vi.doMock(
      "@/modules/salary/services/SalaryCalculatorService.helpers",
      () => ({
        buildActiveLoanDeductionLines,
      }),
    );

    const { SalaryCalculatorService } =
      await import("@/modules/salary/services/SalaryCalculatorService");

    const service = new SalaryCalculatorService();

    prismaMock.userSalaryComponent.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.overtime.findMany.mockResolvedValueOnce([]);
    prismaMock.attendanceEvaluation.findMany.mockResolvedValueOnce([]);
    prismaMock.workOrders.count.mockResolvedValueOnce(0);
    prismaMock.employeeLoan.findMany.mockResolvedValueOnce([
      {
        id: "loan-1",
        installment: 500000,
        remainingAmount: 250000,
      },
    ]);

    const user: UserCalculationData = {
      id: "user-1",
      name: "User One",
      basicSalary: 3000000,
      employeeType: "KARYAWAN",
      departmentId: null,
      siteId: null,
      payPeriodDay: 25,
      payDay: 30,
      woIncentiveEnabled: false,
      woIncentiveRate: null,
      lateDeductionRate: null,
      absentDeductionRate: null,
      overtimeRateNormal: null,
      overtimeRateHoliday: null,
      overtimeRateNational: null,
      overtimeCalcTypeNormal: null,
      overtimeCalcTypeHoliday: null,
      overtimeCalcTypeNational: null,
      workDays: "Senin,Selasa,Rabu,Kamis,Jumat",
      joinDate: null,
      ptkpStatus: null,
      bpjsKesehatan: false,
      bpjsKetenagakerjaan: false,
    };

    const result = await service.calculateSalary("user-1", 4, 2026, user);

    expect(buildActiveLoanDeductionLines).toHaveBeenCalledWith([
      {
        id: "loan-1",
        installment: 500000,
        remainingAmount: 250000,
      },
    ]);
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Loan Helper",
          amount: 777,
          loanId: "loan-1",
          notes: "from helper",
        }),
      ]),
    );
  });

  it("salary calculation helper re-exports tax helper implementation", async () => {
    const calculatePph21TerHelper = vi.fn().mockReturnValue(4242);

    vi.doMock("@/modules/salary/utils/salary-calculation-tax.helpers", () => ({
      calculatePph21Ter: calculatePph21TerHelper,
    }));

    const helpers =
      await import("@/modules/salary/utils/salary-calculation-helpers");

    expect(helpers.calculatePph21Ter(10_000_000, "K_0")).toBe(4242);
    expect(calculatePph21TerHelper).toHaveBeenCalledWith(10_000_000, "K_0");
  });

  it("SalaryMapper still maps repository rows to domain after wiring DTO helpers", async () => {
    const row: SalaryWithRelations = {
      id: "salary-1",
      tenantId: "tenant-1",
      userId: "user-1",
      month: 4,
      year: 2026,
      status: "DRAFT",
      basicSalary: 1000000,
      totalEarnings: 1200000,
      totalDeductions: 200000,
      netSalary: 1000000,
      auditNotes: null,
      calculatedAt: null,
      auditedAt: null,
      approvedAt: null,
      paidAt: null,
      auditedById: null,
      approvedById: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      user: {
        id: "user-1",
        name: "User One",
        email: "user@example.com",
        employeeType: "KARYAWAN",
        departmentId: null,
        siteId: null,
        departments: { name: "Ops" },
        sites: { name: "HQ" },
      },
      details: [],
      revisions: [],
      auditedBy: null,
      approvedBy: null,
    };

    const { SalaryMapper } =
      await import("@/modules/salary/mappers/SalaryMapper");
    const result = SalaryMapper.toDomain(row);

    expect(result.user.email).toBe("user@example.com");
    expect(result.user.departments).toEqual({ name: "Ops" });
  });
});
