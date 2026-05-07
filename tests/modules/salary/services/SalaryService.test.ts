import { describe, it, expect, beforeEach, vi } from "vitest";
import { SalaryService } from "@/modules/salary/services/SalaryService";
import type { ISalaryRepository } from "@/modules/salary/domain/ports/ISalaryRepository";
import type { SalaryCalculatorService } from "@/modules/salary/services/SalaryCalculatorService";
import type { SalaryAuditService } from "@/modules/salary/services/SalaryAuditService";
import type { SalaryWorkflowService } from "@/modules/salary/services/SalaryWorkflowService";
import type { SalaryQueryService } from "@/modules/salary/services/SalaryQueryService";
import type { SalaryCalculationCommandService } from "@/modules/salary/services/SalaryCalculationCommandService";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

// Mock command modules
vi.mock("@/modules/salary/services/SalaryService.commands", () => ({
  calculateSingleSalary: vi.fn(),
  calculateBulkSalary: vi.fn(),
  approveSalaryCommand: vi.fn(),
  markSalaryAsPaid: vi.fn(),
  auditSalaryCommand: vi.fn(),
  recalculateSalaryCommand: vi.fn(),
  deleteSalaryCommand: vi.fn(),
}));

vi.mock("@/modules/salary/services/SalaryService.adjustments", () => ({
  addSalaryAdjustment: vi.fn(),
  requestSalaryRevision: vi.fn(),
  updateSalaryCommand: vi.fn(),
}));

describe("SalaryService", () => {
  let salaryService: SalaryService;
  let mockRepository: ISalaryRepository;
  let mockCalculatorService: SalaryCalculatorService;
  let mockAuditService: SalaryAuditService;
  let mockWorkflowService: SalaryWorkflowService;
  let mockQueryService: SalaryQueryService;
  let mockCalculationCommandService: SalaryCalculationCommandService;

  const mockSalary = {
    id: "salary-1",
    userId: "user-1",
    month: 5,
    year: 2026,
    status: "pending",
    basicSalary: 5000000,
    totalAllowances: 1000000,
    totalDeductions: 500000,
    netSalary: 5500000,
    calculatedById: "admin-1",
    calculatedAt: new Date("2026-05-05"),
  };

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as ISalaryRepository;

    mockCalculatorService = {} as unknown as SalaryCalculatorService;

    mockAuditService = {} as unknown as SalaryAuditService;

    mockWorkflowService = {} as unknown as SalaryWorkflowService;

    mockQueryService = {
      getSalaries: vi.fn(),
      getSalaryById: vi.fn(),
    } as unknown as SalaryQueryService;

    mockCalculationCommandService =
      {} as unknown as SalaryCalculationCommandService;

    salaryService = new SalaryService(
      mockRepository,
      mockCalculatorService,
      mockAuditService,
      mockWorkflowService,
      mockQueryService,
      mockCalculationCommandService,
    );
  });

  describe("getSalaries", () => {
    it("harus return paginated salaries", async () => {
      const filters = {
        month: 5,
        year: 2026,
      };

      const mockResult = {
        success: true,
        data: {
          salaries: [mockSalary],
          total: 1,
          page: 1,
          totalPages: 1,
        },
      };

      vi.mocked(mockQueryService.getSalaries).mockResolvedValue(
        mockResult as never,
      );

      const result = await salaryService.getSalaries(filters, 1, 10);

      expect(result.success).toBe(true);
      expect(mockQueryService.getSalaries).toHaveBeenCalledWith(filters, 1, 10);
    });

    it("harus handle error", async () => {
      const filters = {
        month: 5,
        year: 2026,
      };

      vi.mocked(mockQueryService.getSalaries).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await salaryService.getSalaries(filters);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil data gaji");
    });
  });

  describe("getSalaryById", () => {
    it("harus return salary by id", async () => {
      const mockResult = {
        success: true,
        data: mockSalary,
      };

      vi.mocked(mockQueryService.getSalaryById).mockResolvedValue(
        mockResult as never,
      );

      const result = await salaryService.getSalaryById("salary-1");

      expect(result.success).toBe(true);
      expect(mockQueryService.getSalaryById).toHaveBeenCalledWith("salary-1");
    });

    it("harus handle error", async () => {
      vi.mocked(mockQueryService.getSalaryById).mockRejectedValue(
        new Error("Not found"),
      );

      const result = await salaryService.getSalaryById("salary-999");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gagal mengambil gaji");
    });
  });

  describe("calculateSingle", () => {
    it("harus calculate salary untuk single user", async () => {
      const { calculateSingleSalary } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: { salaryId: "salary-1" },
      };

      vi.mocked(calculateSingleSalary).mockResolvedValue(mockResult as never);

      const result = await salaryService.calculateSingle(
        "user-1",
        5,
        2026,
        "admin-1",
      );

      expect(result.success).toBe(true);
      expect(result.data?.salaryId).toBe("salary-1");
      expect(calculateSingleSalary).toHaveBeenCalled();
    });
  });

  describe("calculateBulk", () => {
    it("harus calculate salary untuk multiple users", async () => {
      const { calculateBulkSalary } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: {
          success: 10,
          failed: [] as Array<{ userId: string; error: string }>,
        },
      };

      vi.mocked(calculateBulkSalary).mockResolvedValue(mockResult as never);

      const result = await salaryService.calculateBulk(
        5,
        2026,
        { departmentId: "dept-1" },
        "admin-1",
      );

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(10);
      expect(calculateBulkSalary).toHaveBeenCalled();
    });
  });

  describe("approveSalary", () => {
    it("harus approve salary", async () => {
      const { approveSalaryCommand } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: { ...mockSalary, status: "approved" },
      };

      vi.mocked(approveSalaryCommand).mockResolvedValue(mockResult as never);

      const result = await salaryService.approveSalary(
        "salary-1",
        "admin-1",
        "Approved",
      );

      expect(result.success).toBe(true);
      expect(approveSalaryCommand).toHaveBeenCalled();
    });
  });

  describe("markAsPaid", () => {
    it("harus mark salary as paid", async () => {
      const { markSalaryAsPaid } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: { ...mockSalary, status: "paid" },
      };

      vi.mocked(markSalaryAsPaid).mockResolvedValue(mockResult as never);

      const result = await salaryService.markAsPaid(
        "salary-1",
        "admin-1",
        "Paid via bank transfer",
      );

      expect(result.success).toBe(true);
      expect(markSalaryAsPaid).toHaveBeenCalled();
    });
  });

  describe("auditSalary", () => {
    it("harus audit salary", async () => {
      const { auditSalaryCommand } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: { ...mockSalary, status: "audited" },
      };

      vi.mocked(auditSalaryCommand).mockResolvedValue(mockResult as never);

      const result = await salaryService.auditSalary(
        "salary-1",
        "auditor-1",
        "Audit completed",
      );

      expect(result.success).toBe(true);
      expect(auditSalaryCommand).toHaveBeenCalled();
    });
  });

  describe("recalculateSalary", () => {
    it("harus recalculate salary", async () => {
      const { recalculateSalaryCommand } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: { salaryId: "salary-1" },
      };

      vi.mocked(recalculateSalaryCommand).mockResolvedValue(
        mockResult as never,
      );

      const result = await salaryService.recalculateSalary(
        "salary-1",
        "admin-1",
      );

      expect(result.success).toBe(true);
      expect(recalculateSalaryCommand).toHaveBeenCalled();
    });
  });

  describe("deleteSalary", () => {
    it("harus delete salary", async () => {
      const { deleteSalaryCommand } =
        await import("@/modules/salary/services/SalaryService.commands");

      const mockResult = {
        success: true,
        data: undefined as void,
      };

      vi.mocked(deleteSalaryCommand).mockResolvedValue(mockResult as never);

      const result = await salaryService.deleteSalary("salary-1", "admin-1");

      expect(result.success).toBe(true);
      expect(deleteSalaryCommand).toHaveBeenCalled();
    });
  });
});
