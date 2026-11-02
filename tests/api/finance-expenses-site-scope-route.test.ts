import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getExpenses: vi.fn(),
  createExpense: vi.fn(),
  createBatchExpenses: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  logAuditActivity: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  const json = (status: number) => (message: string) =>
    NextResponse.json({ success: false, error: message }, { status });
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: { status?: number }) =>
      NextResponse.json(
        { success: true, data },
        { status: meta?.status ?? 200 },
      ),
    ApiErrors: {
      badRequest: json(400),
      forbidden: json(403),
      notFound: json(404),
      conflict: json(409),
    },
  };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));

vi.mock("@/lib/auth", async () => {
  const superAdmin = await import("@/lib/auth/super-admin");
  return { isSuperAdmin: superAdmin.isSuperAdmin };
});

vi.mock("@/lib/middleware/request-logger", () => ({
  logAuditActivity: mocks.logAuditActivity,
}));

vi.mock("@/modules/finance", async () => {
  const scope = await import("@/modules/finance/services/expense-site-scope");
  const errors = await import("@/modules/finance/services/RouteServiceError");
  const idempotency =
    await import("@/modules/finance/services/expense-idempotency");
  return {
    ...idempotency,
    isRouteServiceError: errors.isRouteServiceError,
    resolveExpenseSiteScope: scope.resolveExpenseSiteScope,
    resolveExpenseCreateSiteId: scope.resolveExpenseCreateSiteId,
    FinanceService: class {
      getExpenses = mocks.getExpenses;
      createExpense = mocks.createExpense;
    },
    ExpenseRouteService: class {
      createBatchExpenses = mocks.createBatchExpenses;
      updateExpense = mocks.updateExpense;
      deleteExpense = mocks.deleteExpense;
    },
  };
});

import { GET, POST } from "@/app/api/finance/expenses/route";
import { POST as POST_BATCH } from "@/app/api/finance/expenses/batch/route";
import { PUT, DELETE } from "@/app/api/finance/expenses/[id]/route";

const RESTRICTED = ["expense:read", "expense:create", "expense:site_only"];
const MULTI_SITE_USER = {
  id: "u1",
  role: "Admin Keuangan",
  siteId: "s1",
  siteIds: ["s1", "s2"],
};
const SINGLE_SITE_USER = { id: "u2", role: "Admin Keuangan", siteId: "s1" };
let keyCounter = 0;

function makeCtx(
  user: Record<string, unknown>,
  permissions: string[],
  extra: Record<string, unknown> = {},
) {
  return { session: { user }, permissions, params: {}, ...extra } as never;
}

function jsonRequest(url: string, method: string) {
  keyCounter += 1;
  return new NextRequest(url, {
    method,
    headers: { "x-idempotency-key": `key-${keyCounter}` },
  });
}

describe("/api/finance/expenses site scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.getExpenses.mockResolvedValue([]);
    mocks.createExpense.mockResolvedValue({ id: "e1" });
    mocks.createBatchExpenses.mockResolvedValue([{ id: "e1" }]);
    mocks.updateExpense.mockResolvedValue({ id: "e1" });
    mocks.deleteExpense.mockResolvedValue({ id: "e1" });
  });

  it("GET: role wildcard non-super tidak dibatasi walau hasPermission mengembangkan '*'", async () => {
    await GET(
      new NextRequest("http://localhost/api/finance/expenses"),
      makeCtx(MULTI_SITE_USER, ["*"]),
    );
    expect(mocks.getExpenses.mock.calls[0][0].siteScope).toEqual({
      dibatasi: false,
    });
    expect(mocks.hasPermission).not.toHaveBeenCalledWith("expense:site_only");
  });

  it("GET: pengguna terbatas mendapat lingkup seluruh site-nya", async () => {
    await GET(
      new NextRequest("http://localhost/api/finance/expenses"),
      makeCtx(MULTI_SITE_USER, RESTRICTED),
    );
    expect(mocks.getExpenses.mock.calls[0][0].siteScope).toEqual({
      dibatasi: true,
      siteIds: ["s1", "s2"],
    });
  });

  it("POST: pengguna satu site tanpa pilihan site memakai site-nya", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/finance/expenses", "POST"),
      makeCtx(SINGLE_SITE_USER, RESTRICTED, {
        validated: { amount: 1n, date: new Date(), category: "OPEX" },
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.createExpense.mock.calls[0][0].siteId).toBe("s1");
  });

  it("POST: pengguna terbatas ke site lain ditolak 403", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/finance/expenses", "POST"),
      makeCtx(MULTI_SITE_USER, RESTRICTED, {
        validated: {
          amount: 1n,
          date: new Date(),
          category: "OPEX",
          siteId: "s3",
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("POST: role wildcard non-super boleh memilih site mana pun", async () => {
    await POST(
      jsonRequest("http://localhost/api/finance/expenses", "POST"),
      makeCtx(MULTI_SITE_USER, ["*"], {
        validated: {
          amount: 1n,
          date: new Date(),
          category: "OPEX",
          siteId: "s3",
        },
      }),
    );
    expect(mocks.createExpense.mock.calls[0][0].siteId).toBe("s3");
  });

  it("batch: site tambahan pengguna multi-site diterima", async () => {
    await POST_BATCH(
      jsonRequest("http://localhost/api/finance/expenses/batch", "POST"),
      makeCtx(MULTI_SITE_USER, RESTRICTED, {
        validated: {
          date: new Date(),
          siteId: "s2",
          items: [{ amount: 1n, category: "OPEX" }],
        },
      }),
    );
    expect(mocks.createBatchExpenses.mock.calls[0][0].siteId).toBe("s2");
  });

  it("batch: pengguna terbatas tanpa site ditolak 403", async () => {
    const response = await POST_BATCH(
      jsonRequest("http://localhost/api/finance/expenses/batch", "POST"),
      makeCtx({ id: "u3", role: "Admin Keuangan", siteIds: [] }, RESTRICTED, {
        validated: {
          date: new Date(),
          items: [{ amount: 1n, category: "OPEX" }],
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.createBatchExpenses).not.toHaveBeenCalled();
  });

  it("PUT/DELETE: meneruskan lingkup multi-site ke service", async () => {
    const ctx = makeCtx(MULTI_SITE_USER, RESTRICTED, {
      params: { id: "e1" },
      validated: { amount: 1n, date: new Date(), category: "OPEX" },
    });
    await PUT(
      new NextRequest("http://localhost/api/finance/expenses/e1", {
        method: "PUT",
      }),
      ctx,
    );
    await DELETE(
      new NextRequest("http://localhost/api/finance/expenses/e1", {
        method: "DELETE",
      }),
      ctx,
    );
    const expected = { dibatasi: true, siteIds: ["s1", "s2"] };
    expect(mocks.updateExpense.mock.calls[0][2]).toEqual(expected);
    expect(mocks.deleteExpense.mock.calls[0][1]).toEqual(expected);
  });

  it("PUT: role wildcard non-super tidak dibatasi", async () => {
    await PUT(
      new NextRequest("http://localhost/api/finance/expenses/e1", {
        method: "PUT",
      }),
      makeCtx(MULTI_SITE_USER, ["*"], {
        params: { id: "e1" },
        validated: { amount: 1n, date: new Date(), category: "OPEX" },
      }),
    );
    expect(mocks.updateExpense.mock.calls[0][2]).toEqual({ dibatasi: false });
  });
});
