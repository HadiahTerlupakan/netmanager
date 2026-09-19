import { describe, expect, it, vi } from "vitest";

import {
  FinancialAccountNotFoundError,
  InsufficientBalanceError,
} from "@/modules/finance/domain/errors";
import { FinancialAccountRepository } from "@/modules/finance/repositories/FinancialAccountRepository";

/**
 * Transfer kas & bank dulu hanya menjalankan dua `update` saldo tanpa memeriksa
 * apa pun: akun sumber bisa jadi minus, dan penanganan "saldo tidak cukup" di
 * route tidak pernah tercapai karena tidak ada yang melemparnya.
 */

const TRANSFER = {
  sourceAccountId: "akun-sumber",
  destinationAccountId: "akun-tujuan",
  amount: 500_000,
  date: "2026-09-19",
  description: "Setor tunai ke bank",
  createdById: "user-1",
};

interface FakeClientOptions {
  debitedCount: number;
  creditedCount?: number;
  sourceBalance?: number | null;
}

function createFakeClient({
  debitedCount,
  creditedCount = 1,
  sourceBalance = null,
}: FakeClientOptions) {
  const updateMany = vi
    .fn()
    .mockResolvedValueOnce({ count: debitedCount })
    .mockResolvedValueOnce({ count: creditedCount });
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      sourceBalance === null ? null : { balance: sourceBalance },
    );
  const createMutation = vi.fn().mockResolvedValue({ id: "mutasi-1" });

  const tx = {
    financialAccount: { updateMany, findUnique },
    treasuryMutation: { create: createMutation },
  };
  const client = {
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(tx)),
    financialAccount: { updateMany, findUnique },
    treasuryMutation: { create: createMutation },
  };

  return { client, updateMany, findUnique, createMutation };
}

function createRepository(options: FakeClientOptions) {
  const fake = createFakeClient(options);
  return {
    ...fake,
    repository: new FinancialAccountRepository(
      fake.client as unknown as ConstructorParameters<
        typeof FinancialAccountRepository
      >[0],
    ),
  };
}

describe("FinancialAccountRepository.transferBetweenAccounts", () => {
  it("mendebet hanya bila saldo mencukupi, dalam satu perintah bersyarat", async () => {
    const { repository, updateMany } = createRepository({ debitedCount: 1 });

    await expect(repository.transferBetweenAccounts(TRANSFER)).resolves.toEqual(
      { success: true },
    );

    // Syarat saldo ikut di dalam UPDATE, bukan dibaca lebih dulu lalu dikurangi:
    // transfer lain yang berjalan bersamaan tidak bisa menyalip pemeriksaan.
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: TRANSFER.sourceAccountId,
        balance: { gte: TRANSFER.amount },
      },
      data: { balance: { decrement: TRANSFER.amount } },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: TRANSFER.destinationAccountId },
      data: { balance: { increment: TRANSFER.amount } },
    });
  });

  it("mencatat riwayat mutasi di transaksi yang sama dengan perubahan saldo", async () => {
    const { repository, createMutation } = createRepository({
      debitedCount: 1,
    });

    await repository.transferBetweenAccounts(TRANSFER);

    expect(createMutation).toHaveBeenCalledWith({
      data: {
        date: new Date(TRANSFER.date),
        amount: TRANSFER.amount,
        description: TRANSFER.description,
        sourceAccountId: TRANSFER.sourceAccountId,
        destinationAccountId: TRANSFER.destinationAccountId,
        createdById: TRANSFER.createdById,
      },
    });
  });

  it("menolak transfer yang melebihi saldo alih-alih membuat saldo minus", async () => {
    const { repository, updateMany, createMutation } = createRepository({
      debitedCount: 0,
      sourceBalance: 100_000,
    });

    await expect(
      repository.transferBetweenAccounts(TRANSFER),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    // Akun tujuan tidak boleh ikut bertambah saat pendebetan gagal, dan tidak
    // boleh ada baris riwayat untuk transfer yang tidak jadi.
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(createMutation).not.toHaveBeenCalled();
  });

  it("membawa saldo tersedia pada error agar bisa dilaporkan", async () => {
    const { repository } = createRepository({
      debitedCount: 0,
      sourceBalance: 100_000,
    });

    await expect(
      repository.transferBetweenAccounts(TRANSFER),
    ).rejects.toMatchObject({
      accountId: TRANSFER.sourceAccountId,
      requested: TRANSFER.amount,
      available: 100_000,
    });
  });

  it("membedakan akun sumber yang tidak ada dari saldo yang kurang", async () => {
    const { repository } = createRepository({
      debitedCount: 0,
      sourceBalance: null,
    });

    await expect(
      repository.transferBetweenAccounts(TRANSFER),
    ).rejects.toBeInstanceOf(FinancialAccountNotFoundError);
  });

  it("menolak bila akun tujuan tidak ada", async () => {
    const { repository } = createRepository({
      debitedCount: 1,
      creditedCount: 0,
    });

    await expect(
      repository.transferBetweenAccounts(TRANSFER),
    ).rejects.toBeInstanceOf(FinancialAccountNotFoundError);
  });
});
