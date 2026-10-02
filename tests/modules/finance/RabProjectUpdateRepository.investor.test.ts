import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  ModalInvestorTerkunciError,
  RabProjectUpdateRepository,
} from "@/modules/finance/repositories/RabProjectUpdateRepository";

const PROYEK = {
  id: "rab-1",
  projectedOpex: 0n,
  targetSubscribers: 0,
  arpu: null as bigint | null,
  growthType: "LINEAR",
  paymentType: "PREPAID",
  growthSettings: null as unknown,
  investmentDurationMonths: 12,
  investorProfitSharePercent: 50,
  nplTolerancePercent: 0,
  opexBufferFundingMode: "COMPANY",
  opexBufferInvestorPercent: 0,
  opexBufferInvestorFixedAmount: 0n,
  opexBufferSafetyPercent: 0,
  items: [{ quantity: 1, unitPrice: 10_000_000n, expenseType: "CAPEX" }],
};

function buatTx(investorAda: { investorId: string; investmentAmount: bigint }[]) {
  return {
    rabProject: {
      update: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(PROYEK),
    },
    rabInvestor: {
      findMany: vi.fn().mockResolvedValue(investorAda),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buatRepo(tx: ReturnType<typeof buatTx>) {
  const client = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  return new RabProjectUpdateRepository(client as never);
}

describe("RabProjectUpdateRepository — investor & modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daftar investor sama: baris tidak dihapus-buat ulang", async () => {
    const tx = buatTx([
      { investorId: "a", investmentAmount: 5_000_000n },
      { investorId: "b", investmentAmount: 5_000_000n },
    ]);

    await buatRepo(tx).updateProjectWithRelations("rab-1", { name: "x", investorIds: ["b", "a"] });

    expect(tx.rabInvestor.deleteMany).not.toHaveBeenCalled();
    expect(tx.rabInvestor.createMany).not.toHaveBeenCalled();
  });

  it("daftar berubah tanpa kunci: investor diganti, modal dibagi rata dari mesin RAB", async () => {
    const tx = buatTx([{ investorId: "a", investmentAmount: 10_000_000n }]);

    await buatRepo(tx).updateProjectWithRelations("rab-1", { investorIds: ["a", "c"] });

    expect(tx.rabInvestor.deleteMany).toHaveBeenCalled();
    expect(tx.rabInvestor.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ investorId: "a", investmentAmount: 5_000_000n }),
        expect.objectContaining({ investorId: "c", investmentAmount: 5_000_000n }),
      ],
    });
  });

  it("terkunci (sudah ada bagi hasil): ganti investor atau ubah modal ditolak", async () => {
    const tx = buatTx([{ investorId: "a", investmentAmount: 10_000_000n }]);
    const repo = buatRepo(tx);

    await expect(
      repo.updateProjectWithRelations("rab-1", { investorIds: ["a", "c"] }, true),
    ).rejects.toBeInstanceOf(ModalInvestorTerkunciError);

    // Item berubah → modal ikut berubah → ditolak.
    tx.rabProject.findUnique.mockResolvedValue({
      ...PROYEK,
      items: [{ quantity: 1, unitPrice: 12_000_000n, expenseType: "CAPEX" }],
    });
    await expect(
      repo.updateProjectWithRelations("rab-1", { projectedOpex: 0n }, true),
    ).rejects.toBeInstanceOf(ModalInvestorTerkunciError);
  });

  it("terkunci tetapi modal tidak berubah: perubahan lain tetap boleh", async () => {
    const tx = buatTx([{ investorId: "a", investmentAmount: 10_000_000n }]);

    await expect(
      buatRepo(tx).updateProjectWithRelations("rab-1", { name: "Nama baru", projectedOpex: 0n }, true),
    ).resolves.toMatchObject({ id: "rab-1" });
  });
});
