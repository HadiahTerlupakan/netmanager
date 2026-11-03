import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { ResellerSettlementLifecycleService } from "@/modules/reseller/services/ResellerSettlementLifecycleService";
import type { IResellerSettlementRepository } from "@/modules/reseller/domain/ports/IResellerSettlementRepository";
import type { IResellerAccountingEvents } from "@/modules/reseller/domain/ports/IResellerAccountingEvents";
import type { ResellerSettlementEntity } from "@/modules/reseller/domain/entities/ResellerCommissionEntity";
import { payResellerSettlementSchema } from "@/modules/reseller/validators/reseller-commission";

const NOW = new Date("2026-11-03T08:00:00.000Z");

const PENDING: ResellerSettlementEntity = {
  id: "settlement-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  periodStart: new Date("2026-10-01T00:00:00.000Z"),
  periodEnd: new Date("2026-10-31T23:59:59.999Z"),
  totalAmount: 50000,
  commissionCount: 2,
  status: "PENDING",
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  approvedAt: null,
  paidAt: null,
  approvedById: null,
  paidById: null,
  paymentMethod: null,
  paymentReference: null,
  paymentAccountId: null,
  deletedAt: null,
};
const APPROVED: ResellerSettlementEntity = {
  ...PENDING,
  status: "APPROVED",
  approvedAt: NOW,
  approvedById: "user-1",
};
const PAID: ResellerSettlementEntity = {
  ...APPROVED,
  status: "PAID",
  paidAt: NOW,
  paidById: "user-1",
  paymentMethod: "BANK_TRANSFER",
  paymentAccountId: "account-1",
};

const REF = {
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  settlementId: "settlement-1",
  actorId: "user-1",
};
const PAYMENT = {
  ...REF,
  paidAt: new Date("2026-11-03T00:00:00.000Z"),
  paymentMethod: "BANK_TRANSFER",
  paymentReference: "TRX-1",
  accountId: "account-1",
};

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error.statusCode;
    throw error;
  }
  throw new Error("Expected rejection");
}

describe("ResellerSettlementLifecycleService", () => {
  let repository: IResellerSettlementRepository;
  let events: IResellerAccountingEvents;
  let service: ResellerSettlementLifecycleService;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(PENDING),
      approve: vi.fn().mockResolvedValue(APPROVED),
      markPaid: vi.fn().mockResolvedValue({ kind: "paid", settlement: PAID }),
      paymentAccountExists: vi.fn().mockResolvedValue(true),
      listPaymentAccounts: vi.fn().mockResolvedValue([]),
    };
    events = {
      commissionAccrued: vi.fn(),
      commissionCancelled: vi.fn(),
      settlementPaid: vi.fn(),
    };
    service = new ResellerSettlementLifecycleService(
      repository,
      events,
      () => NOW,
    );
  });

  it("menyetujui settlement PENDING dan mencatat penyetujunya", async () => {
    const result = await service.approve(REF);

    expect(result.status).toBe("APPROVED");
    expect(repository.findById).toHaveBeenCalledWith(
      "tenant-1",
      "reseller-1",
      "settlement-1",
    );
    expect(repository.approve).toHaveBeenCalledWith({
      settlementId: "settlement-1",
      approvedAt: NOW,
      approvedById: "user-1",
    });
  });

  it("idempoten: menyetujui ulang mengembalikan settlement tanpa menulis", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(APPROVED);

    expect(await service.approve(REF)).toBe(APPROVED);
    expect(repository.approve).not.toHaveBeenCalled();
  });

  it("menolak menyetujui settlement yang sudah dibayar dengan 409", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(PAID);

    expect(await statusOf(service.approve(REF))).toBe(409);
  });

  it("menerima kekalahan balapan bila hasilnya sama dengan tujuan", async () => {
    vi.mocked(repository.approve).mockResolvedValueOnce(null);
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce(APPROVED);

    expect(await service.approve(REF)).toBe(APPROVED);
  });

  it("menjawab 409 bila balapan berakhir di status lain", async () => {
    vi.mocked(repository.approve).mockResolvedValueOnce(null);
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce(PAID);

    expect(await statusOf(service.approve(REF))).toBe(409);
  });

  it("menjawab 404 untuk settlement reseller/tenant lain", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    expect(await statusOf(service.approve(REF))).toBe(404);
  });

  it("menandai settlement APPROVED dibayar dan mengabarkan accounting", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(APPROVED);

    const result = await service.markPaid(PAYMENT);

    expect(result).toBe(PAID);
    expect(repository.paymentAccountExists).toHaveBeenCalledWith(
      "tenant-1",
      "account-1",
    );
    expect(repository.markPaid).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      paidAt: PAYMENT.paidAt,
      paidById: "user-1",
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "TRX-1",
      paymentAccountId: "account-1",
    });
    expect(events.settlementPaid).toHaveBeenCalledWith(PAID);
  });

  it("menolak bayar sebelum disetujui dengan 409", async () => {
    expect(await statusOf(service.markPaid(PAYMENT))).toBe(409);
    expect(repository.markPaid).not.toHaveBeenCalled();
    expect(events.settlementPaid).not.toHaveBeenCalled();
  });

  it("idempoten: bayar ulang tidak menulis, hanya mengirim ulang event jurnal", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(PAID);

    expect(await service.markPaid(PAYMENT)).toBe(PAID);
    expect(repository.markPaid).not.toHaveBeenCalled();
    expect(events.settlementPaid).toHaveBeenCalledWith(PAID);
  });

  it("menolak rekening yang bukan milik tenant/nonaktif dengan 400", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(APPROVED);
    vi.mocked(repository.paymentAccountExists).mockResolvedValueOnce(false);

    expect(await statusOf(service.markPaid(PAYMENT))).toBe(400);
    expect(repository.markPaid).not.toHaveBeenCalled();
  });

  it("menolak saldo rekening yang kurang dengan 400 tanpa mengirim jurnal", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(APPROVED);
    vi.mocked(repository.markPaid).mockResolvedValueOnce({
      kind: "insufficient-balance",
    });

    const error = await service.markPaid(PAYMENT).catch((caught) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(400);
    expect((error as AppError).message).toContain("Saldo rekening");
    expect(events.settlementPaid).not.toHaveBeenCalled();
  });

  it("menerima kekalahan balapan bila permintaan lain sudah membayar", async () => {
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(APPROVED)
      .mockResolvedValueOnce(PAID);
    vi.mocked(repository.markPaid).mockResolvedValueOnce({
      kind: "status-changed",
    });

    expect(await service.markPaid(PAYMENT)).toBe(PAID);
  });

  it("menolak tanggal bayar di masa depan dengan 400", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(APPROVED);

    expect(
      await statusOf(
        service.markPaid({
          ...PAYMENT,
          paidAt: new Date("2026-11-10T00:00:00.000Z"),
        }),
      ),
    ).toBe(400);
  });
});

describe("payResellerSettlementSchema", () => {
  it("menerima pembayaran lengkap dan mengosongkan referensi kosong", () => {
    expect(
      payResellerSettlementSchema.parse({
        paidAt: "2026-11-03",
        paymentMethod: "CASH",
        paymentReference: "  ",
        accountId: "account-1",
      }),
    ).toMatchObject({ paymentMethod: "CASH", paymentReference: null });
  });

  it.each([
    [{ paymentMethod: "CASH", accountId: "a" }],
    [{ paidAt: "2026-11-03", paymentMethod: "CHEQUE", accountId: "a" }],
    [{ paidAt: "2026-11-03", paymentMethod: "CASH", accountId: "" }],
  ])("menolak %j", (input) => {
    expect(payResellerSettlementSchema.safeParse(input).success).toBe(false);
  });
});
