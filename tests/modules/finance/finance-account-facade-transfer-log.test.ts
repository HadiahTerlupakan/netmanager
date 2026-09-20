import { beforeEach, describe, expect, it, vi } from "vitest";

// `logger` ikut disediakan: service ini menarik modul akuntansi yang memakainya.
vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logActivitySafe } from "@/lib/logger";
import { FinanceAccountFacadeService } from "@/modules/finance/services/FinanceAccountFacadeService";

/**
 * Form "Mutasi Saldo" mewajibkan tanggal dan menyediakan keterangan, lalu route
 * mengirim keduanya ke service. Sebelumnya service membuangnya tanpa menyimpan
 * ke mana pun, sehingga tanggal yang dipilih operator hilang begitu saja.
 * Selama belum ada tabel riwayat mutasi, log aktivitas adalah satu-satunya jejak.
 */

const TRANSFER = {
  sourceAccountId: "akun-sumber",
  destinationAccountId: "akun-tujuan",
  amount: 250_000,
  date: "2026-09-19",
  description: "Setor tunai ke bank",
  createdById: "user-1",
};

function createService() {
  const repo = {
    findActive: vi.fn(),
    create: vi.fn(),
    transferBetweenAccounts: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    repo,
    service: new FinanceAccountFacadeService(
      repo as unknown as ConstructorParameters<
        typeof FinanceAccountFacadeService
      >[0],
    ),
  };
}

describe("FinanceAccountFacadeService.transferFunds", () => {
  beforeEach(() => {
    vi.mocked(logActivitySafe).mockClear();
  });

  it("mencatat tanggal dan keterangan yang diisi operator", async () => {
    const { service } = createService();

    await service.transferFunds(TRANSFER);

    expect(logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TRANSFER",
        userId: TRANSFER.createdById,
        details: expect.objectContaining({
          from: TRANSFER.sourceAccountId,
          to: TRANSFER.destinationAccountId,
          amount: TRANSFER.amount,
          date: new Date(TRANSFER.date).toISOString(),
          description: TRANSFER.description,
        }),
      }),
    );
  });

  it("tetap mencatat tanggal saat keterangan dikosongkan", async () => {
    const { service } = createService();
    const { description: _description, ...tanpaKeterangan } = TRANSFER;

    await service.transferFunds(tanpaKeterangan);

    const details = vi.mocked(logActivitySafe).mock.calls[0]?.[0].details as
      | Record<string, unknown>
      | undefined;
    expect(details?.date).toBe(new Date(TRANSFER.date).toISOString());
    expect(details).not.toHaveProperty("description");
  });

  it("tidak mencatat aktivitas bila transfer gagal", async () => {
    const { service, repo } = createService();
    repo.transferBetweenAccounts.mockRejectedValueOnce(
      new Error("Saldo tidak cukup untuk melakukan transfer"),
    );

    await expect(service.transferFunds(TRANSFER)).rejects.toThrow();
    expect(logActivitySafe).not.toHaveBeenCalled();
  });
});
