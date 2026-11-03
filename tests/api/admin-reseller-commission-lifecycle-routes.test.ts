import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gerbang, validasi, dan pemetaan galat route aturan komisi, siklus settlement,
 * dan laporan reseller lewat `createHandler` asli. Service dipalsukan.
 */

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  rules: {
    listRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deactivateRule: vi.fn(),
  },
  lifecycle: {
    approve: vi.fn(),
    markPaid: vi.fn(),
    listPaymentAccounts: vi.fn(),
  },
  report: { getMonthlyReport: vi.fn() },
  reversal: { listAdjustments: vi.fn() },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/modules/feature-flags", () => ({
  getFeatureFlagService: () => ({ isEnabled: async () => true }),
}));
vi.mock("@/modules/reseller", async () => {
  const commissionValidators =
    await import("@/modules/reseller/validators/reseller-commission");
  const ruleValidators =
    await import("@/modules/reseller/validators/reseller-commission-rule");
  const dto = await import("@/modules/reseller/dto/commission.dto");
  const permissions =
    await import("@/modules/reseller/domain/reseller-finance-permissions");
  const csv = await import("@/modules/reseller/services/reseller-report-csv");
  return {
    ...commissionValidators,
    ...ruleValidators,
    ...dto,
    ...permissions,
    ...csv,
    getResellerCommissionRuleService: () => mocks.rules,
    getResellerSettlementLifecycleService: () => mocks.lifecycle,
    getResellerReportService: () => mocks.report,
    getResellerCommissionReversalService: () => mocks.reversal,
  };
});

import {
  GET as listRules,
  POST as createRule,
} from "@/app/api/admin/resellers/[id]/commission-rules/route";
import {
  DELETE as deactivateRule,
  PATCH as updateRule,
} from "@/app/api/admin/resellers/[id]/commission-rules/[ruleId]/route";
import { POST as approveSettlement } from "@/app/api/admin/resellers/[id]/settlements/[settlementId]/approve/route";
import { POST as paySettlement } from "@/app/api/admin/resellers/[id]/settlements/[settlementId]/pay/route";
import { GET as getReport } from "@/app/api/admin/resellers/[id]/report/route";
import { GET as listPaymentAccounts } from "@/app/api/admin/resellers/[id]/payment-accounts/route";
import { GET as listAdjustments } from "@/app/api/admin/resellers/[id]/commission-adjustments/route";
import { ResellerConflictError } from "@/modules/reseller/errors/reseller-errors";
import type {
  ResellerCommissionRuleEntity,
  ResellerSettlementEntity,
} from "@/modules/reseller/domain/entities/ResellerCommissionEntity";
import type { ResellerMonthlyReport } from "@/modules/reseller/domain/entities/ResellerReportEntity";

const FINANCE = ["reseller:update", "transactions:create"];
const RULE: ResellerCommissionRuleEntity = {
  id: "rule-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  hargaPaketId: null,
  type: "PERCENTAGE",
  rate: 10,
  fixedAmount: null,
  status: "ACTIVE",
  startsAt: new Date("2026-11-01T00:00:00.000Z"),
  endsAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const SETTLEMENT: ResellerSettlementEntity = {
  id: "settlement-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  periodStart: new Date("2026-10-01T00:00:00.000Z"),
  periodEnd: new Date("2026-10-31T23:59:59.999Z"),
  totalAmount: 50000,
  commissionCount: 2,
  status: "APPROVED",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  approvedAt: new Date(),
  paidAt: null,
  createdById: null,
  approvedById: "user-1",
  paidById: null,
  paymentMethod: null,
  paymentReference: null,
  paymentAccountId: null,
  adjustmentAmount: 0,
  deletedAt: null,
};
const REPORT: ResellerMonthlyReport = {
  resellerId: "reseller-1",
  resellerCode: "RS01",
  resellerName: "Mitra",
  period: "2026-10",
  rows: [],
  totals: {
    activeCustomers: 0,
    grossBilled: 0,
    paid: 0,
    commissionAccrued: 0,
    commissionSettled: 0,
    commissionPaid: 0,
    commissionAdjusted: 0,
  },
};

function signInWith(permissions: string[]): void {
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "a@example.com",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      permissions,
    },
  });
}

function request(path: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/resellers/reseller-1/${path}`,
    {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

const context = (params: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: "reseller-1", ...params }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rules.listRules.mockResolvedValue([{ ...RULE, hargaPaketName: null }]);
  mocks.rules.createRule.mockResolvedValue(RULE);
  mocks.rules.updateRule.mockResolvedValue(RULE);
  mocks.rules.deactivateRule.mockResolvedValue({
    ...RULE,
    status: "INACTIVE",
  });
  mocks.lifecycle.approve.mockResolvedValue(SETTLEMENT);
  mocks.lifecycle.markPaid.mockResolvedValue({
    ...SETTLEMENT,
    status: "PAID",
  });
  mocks.report.getMonthlyReport.mockResolvedValue(REPORT);
  mocks.lifecycle.listPaymentAccounts.mockResolvedValue([
    { id: "account-1", name: "BCA", type: "BANK", balance: 100000 },
  ]);
});

describe("commission-adjustments", () => {
  it("mendaftar koreksi reseller di tenant sesi dengan paginasi", async () => {
    signInWith(["reseller:read"]);
    mocks.reversal.listAdjustments.mockResolvedValueOnce({
      items: [
        {
          id: "adjustment-1",
          tenantId: "tenant-1",
          resellerId: "reseller-1",
          pelangganId: "pelanggan-1",
          invoiceId: "invoice-1",
          sourceCommissionId: "commission-1",
          amount: 10000,
          remainingAmount: 4000,
          reason: "Invoice di-void setelah komisi dibayar",
          createdAt: new Date("2026-11-02T00:00:00.000Z"),
        },
      ],
      total: 1,
    });

    const response = await listAdjustments(
      request("commission-adjustments?limit=5&page=2"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mocks.reversal.listAdjustments).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      skip: 5,
      take: 5,
    });
    expect((await response.json()).data).toEqual([
      expect.objectContaining({
        id: "adjustment-1",
        amount: 10000,
        remainingAmount: 4000,
        createdAt: "2026-11-02T00:00:00.000Z",
      }),
    ]);
  });

  it("menolak 403 tanpa reseller:read", async () => {
    signInWith([]);

    const response = await listAdjustments(
      request("commission-adjustments"),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mocks.reversal.listAdjustments).not.toHaveBeenCalled();
  });
});

// Reviewer: form bayar dulu memuat /api/finance/accounts (izin baca kas),
// sehingga pembayar dengan izin keuangan reseller tidak bisa memilih rekening.
describe("payment-accounts", () => {
  it("menyajikan rekening tenant dengan izin keuangan reseller saja", async () => {
    signInWith(FINANCE);

    const response = await listPaymentAccounts(
      request("payment-accounts"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mocks.lifecycle.listPaymentAccounts).toHaveBeenCalledWith(
      "tenant-1",
    );
    expect((await response.json()).data).toEqual([
      { id: "account-1", name: "BCA", type: "BANK", balance: 100000 },
    ]);
  });

  it("menolak 403 tanpa transactions:create", async () => {
    signInWith(["reseller:update"]);

    const response = await listPaymentAccounts(
      request("payment-accounts"),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mocks.lifecycle.listPaymentAccounts).not.toHaveBeenCalled();
  });
});

describe("commission-rules", () => {
  it("membaca aturan dengan reseller:read", async () => {
    signInWith(["reseller:read"]);

    const response = await listRules(request("commission-rules"), context());

    expect(response.status).toBe(200);
    expect(mocks.rules.listRules).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
    );
  });

  it("menolak 403 membuat aturan hanya dengan reseller:update", async () => {
    signInWith(["reseller:update"]);

    const response = await createRule(
      request("commission-rules", "POST", { type: "PERCENTAGE", rate: 10 }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mocks.rules.createRule).not.toHaveBeenCalled();
  });

  it("menolak 400 persen di luar 1–100", async () => {
    signInWith(FINANCE);

    const response = await createRule(
      request("commission-rules", "POST", { type: "PERCENTAGE", rate: 150 }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mocks.rules.createRule).not.toHaveBeenCalled();
  });

  it("membuat aturan dengan izin keuangan lengkap", async () => {
    signInWith(FINANCE);

    const response = await createRule(
      request("commission-rules", "POST", { type: "FIXED", fixedAmount: 5000 }),
      context(),
    );

    expect(response.status).toBe(201);
    expect(mocks.rules.createRule).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      expect.objectContaining({ type: "FIXED", fixedAmount: 5000 }),
    );
  });

  it("memetakan bentrok aturan ke 409", async () => {
    signInWith(FINANCE);
    mocks.rules.updateRule.mockRejectedValueOnce(
      new ResellerConflictError("bentrok"),
    );

    const response = await updateRule(
      request("commission-rules/rule-1", "PATCH", { status: "ACTIVE" }),
      context({ ruleId: "rule-1" }),
    );

    expect(response.status).toBe(409);
  });

  it("menonaktifkan aturan lewat DELETE", async () => {
    signInWith(FINANCE);

    const response = await deactivateRule(
      request("commission-rules/rule-1", "DELETE"),
      context({ ruleId: "rule-1" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("INACTIVE");
  });
});

describe("settlement lifecycle", () => {
  it("menolak 403 approve tanpa transactions:create", async () => {
    signInWith(["reseller:update"]);

    const response = await approveSettlement(
      request("settlements/settlement-1/approve", "POST"),
      context({ settlementId: "settlement-1" }),
    );

    expect(response.status).toBe(403);
  });

  it("menyetujui dengan pelaku dari sesi", async () => {
    signInWith(FINANCE);

    const response = await approveSettlement(
      request("settlements/settlement-1/approve", "POST"),
      context({ settlementId: "settlement-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.lifecycle.approve).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      settlementId: "settlement-1",
      actorId: "user-1",
    });
  });

  it("memetakan transisi tidak sah ke 409", async () => {
    signInWith(FINANCE);
    mocks.lifecycle.markPaid.mockRejectedValueOnce(
      new ResellerConflictError("belum disetujui"),
    );

    const response = await paySettlement(
      request("settlements/settlement-1/pay", "POST", {
        paidAt: "2026-11-03",
        paymentMethod: "CASH",
        accountId: "account-1",
      }),
      context({ settlementId: "settlement-1" }),
    );

    expect(response.status).toBe(409);
  });

  it("menolak 400 pembayaran tanpa rekening", async () => {
    signInWith(FINANCE);

    const response = await paySettlement(
      request("settlements/settlement-1/pay", "POST", {
        paidAt: "2026-11-03",
        paymentMethod: "CASH",
      }),
      context({ settlementId: "settlement-1" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.lifecycle.markPaid).not.toHaveBeenCalled();
  });

  it("meneruskan data pembayaran ke service", async () => {
    signInWith(FINANCE);

    const response = await paySettlement(
      request("settlements/settlement-1/pay", "POST", {
        paidAt: "2026-11-03",
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TRX-9",
        accountId: "account-1",
      }),
      context({ settlementId: "settlement-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.lifecycle.markPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TRX-9",
        accountId: "account-1",
        actorId: "user-1",
      }),
    );
  });
});

describe("report", () => {
  it("menolak 400 periode tidak valid", async () => {
    signInWith(["reseller:read"]);

    const response = await getReport(
      request("report?period=2026-13"),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mocks.report.getMonthlyReport).not.toHaveBeenCalled();
  });

  it("mengembalikan JSON laporan", async () => {
    signInWith(["reseller:read"]);

    const response = await getReport(
      request("report?period=2026-10"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mocks.report.getMonthlyReport).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      "2026-10",
    );
  });

  it("mengunduh CSV dengan format=csv", async () => {
    signInWith(["reseller:read"]);

    const response = await getReport(
      request("report?period=2026-10&format=csv"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "laporan-reseller-RS01-2026-10.csv",
    );
    expect(await response.text()).toContain("TOTAL");
  });
});
