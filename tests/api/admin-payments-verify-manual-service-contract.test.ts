import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Regresi: route verify-manual dan layanannya tidak pernah sepakat soal
 * action. Route menerima "approve" lalu layanan hanya mengenal "APPROVE",
 * sehingga perbaikan yang hanya menyentuh route tetap dijawab "Invalid
 * action" di produksi. Tes ini memakai layanan asli, hanya helper dan
 * repository yang dipalsukan.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  approveManualPayment: vi.fn(),
  rejectManualPayment: vi.fn(),
  findByIdWithInvoice: vi.fn(),
  checkSiteRestriction: vi.fn(),
  findPelangganById: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserPermissions: mockFns.getUserPermissions,
}));
vi.mock(
  "@/modules/finance/services/manual-payment-admin.helpers",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    approveManualPayment: mockFns.approveManualPayment,
    rejectManualPayment: mockFns.rejectManualPayment,
  }),
);
vi.mock("@/modules/finance/repositories/PaymentRepository", () => ({
  PaymentRepository: class {
    findByIdWithInvoice = mockFns.findByIdWithInvoice;
  },
}));
vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class {},
}));
vi.mock("@/modules/finance/pelanggan-registry", () => ({
  getPelangganBillingBridge: () => ({ findById: mockFns.findPelangganById }),
}));
vi.mock("@/modules/roles", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkSiteRestriction: mockFns.checkSiteRestriction,
}));

const { POST } = await import("@/app/api/admin/payments/verify-manual/route");

function verify(action: string) {
  return POST(
    new NextRequest("http://localhost/api/admin/payments/verify-manual", {
      method: "POST",
      body: JSON.stringify({ paymentId: "pay-1", action }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({}) },
  );
}

describe("verify-manual — route dan layanan asli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", tenantId: "t1" },
    });
    mockFns.getUserPermissions.mockResolvedValue(["manual_payments:verify"]);
    mockFns.findByIdWithInvoice.mockResolvedValue({
      id: "pay-1",
      pelangganId: "pel-1",
      gatewayStatus: "PENDING",
    });
    mockFns.approveManualPayment.mockResolvedValue({ ok: true });
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteIds: [] as string[],
    });
    mockFns.findPelangganById.mockResolvedValue({
      id: "pel-1",
      siteId: "site-a",
    });
    mockFns.rejectManualPayment.mockResolvedValue({ ok: true });
  });

  it("tombol Setujui (APPROVE) sampai ke jalur approve", async () => {
    const response = await verify("APPROVE");

    expect(response.status).toBe(200);
    expect(mockFns.approveManualPayment).toHaveBeenCalledTimes(1);
  });

  it("tombol Tolak (REJECT) sampai ke jalur reject", async () => {
    const response = await verify("REJECT");

    expect(response.status).toBe(200);
    expect(mockFns.rejectManualPayment).toHaveBeenCalledTimes(1);
  });

  it("admin terbatas tanpa site ditolak, bukan dibebaskan", async () => {
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: [] as string[],
    });

    const response = await verify("APPROVE");

    expect(response.status).toBe(400);
    expect(mockFns.approveManualPayment).not.toHaveBeenCalled();
  });

  it("admin terbatas hanya bisa memverifikasi pelanggan di site-nya", async () => {
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: ["site-b"],
    });

    const response = await verify("APPROVE");

    expect(response.status).toBe(400);
    expect(mockFns.approveManualPayment).not.toHaveBeenCalled();
  });
});
