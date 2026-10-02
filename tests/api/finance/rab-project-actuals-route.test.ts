import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";

const { mockHasPermission, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (
      options: { schema?: { parse: (value: unknown) => unknown } },
      handler: (
        req: NextRequest,
        ctx: {
          params: Record<string, string>;
          session: { user: { id: string } };
          validated?: unknown;
        },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest,
      { params }: { params?: Promise<Record<string, string>> },
    ) => {
      const body = request.body ? await request.clone().json() : undefined;
      return handler(request, {
        params: (await params) ?? {},
        session: { user: { id: "user-1" } },
        validated: options.schema ? options.schema.parse(body) : body,
      });
    },
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message: string) =>
      NextResponse.json({ error: message }, { status: 404 }),
    conflict: (message: string) =>
      NextResponse.json({ error: message }, { status: 409 }),
  },
}));

import { POST } from "@/app/api/finance/rab-projects/[id]/actuals/route";

const payload = {
  month: 1,
  year: 2026,
  actualSubscribers: 12,
  actualRevenue: 120000,
};

describe("rab project actuals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(false);
    Object.assign(prismaMock, {
      rabProject: prismaMock.rabProject,
      rabActualAchievement: prismaMock.rabActualAchievement,
    });
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-1",
      startDate: new Date("2026-11-01T00:00:00.000Z"),
    });
    prismaMock.investorProfitShare.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    prismaMock.rabActualAchievement.findMany.mockResolvedValue([]);
    prismaMock.rabActualAchievement.create.mockResolvedValue({
      id: "actual-1",
      actualRevenue: 120000n,
      actualOpex: 0n,
      manualRecoveryInstallment: null,
      manualInvestorShare: null,
      manualCompanyShare: null,
      manualInvestorProfitSharePercent: null,
    });
  });

  it("requires update permission because actuals mutate an existing RAB", async () => {
    mockHasPermission.mockImplementation(
      async (permission: string) => permission === "expense:update",
    );

    const response = await POST(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/actuals",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
        },
      ),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockHasPermission).toHaveBeenCalledWith("expense:update");
    expect(prismaMock.rabActualAchievement.create).toHaveBeenCalled();
  });

  it("tahun dihitung dari tanggal mulai proyek, bukan dari klien", async () => {
    mockHasPermission.mockResolvedValue(true);

    // Proyek mulai Nov 2026 → bulan ke-3 = Januari 2027 (klien mengirim 2026).
    await POST(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1/actuals", {
        method: "POST",
        body: JSON.stringify({ ...payload, month: 3, year: 2026 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(prismaMock.rabActualAchievement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rabProjectId: "rab-1", month: 3, year: 2027 }),
    });
  });

  it("baris ganda bulan yang sama (data lama) dirapikan: terbaru diperbarui, sisanya dihapus", async () => {
    mockHasPermission.mockResolvedValue(true);
    prismaMock.rabActualAchievement.findMany.mockResolvedValue([{ id: "baru" }, { id: "lama" }]);
    prismaMock.rabActualAchievement.update.mockResolvedValue({
      id: "baru",
      actualRevenue: 120000n,
      actualOpex: null,
      manualRecoveryInstallment: null,
      manualInvestorShare: null,
      manualCompanyShare: null,
      manualInvestorProfitSharePercent: null,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1/actuals", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.rabActualAchievement.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["lama"] } },
    });
    expect(prismaMock.rabActualAchievement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "baru" } }),
    );
  });

  it("bulan yang sudah masuk bagi hasil investor ditolak 409", async () => {
    mockHasPermission.mockResolvedValue(true);
    prismaMock.investorProfitShare.findFirst.mockResolvedValue({ id: "ph-1" });

    const response = await POST(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1/actuals", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(409);
    expect(prismaMock.rabActualAchievement.create).not.toHaveBeenCalled();
  });

  it("angka negatif atau persen di atas 100 ditolak validasi", () => {
    // Validasi skema dijalankan oleh createHandler (mock memanggil schema.parse).
    const kirim = (body: unknown) =>
      POST(
        new NextRequest("http://localhost/api/finance/rab-projects/rab-1/actuals", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ id: "rab-1" }) },
      );
    return Promise.all([
      expect(kirim({ ...payload, actualRevenue: -5 })).rejects.toThrow(),
      expect(kirim({ ...payload, manualInvestorProfitSharePercent: 150 })).rejects.toThrow(),
    ]);
  });

  it("rejects create-only users from mutating actuals", async () => {
    mockHasPermission.mockImplementation(
      async (permission: string) => permission === "expense:create",
    );

    const response = await POST(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/actuals",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
        },
      ),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(403);
    expect(prismaMock.rabActualAchievement.upsert).not.toHaveBeenCalled();
  });
});
