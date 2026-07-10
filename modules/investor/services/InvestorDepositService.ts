import { InvestorDepositRepository } from "../repositories/InvestorDepositRepository";
import type {
  InvestorDepositType,
  InvestorDepositStatus,
} from "@prisma/client";

export interface CreateDepositInput {
  investorId: string;
  amount: number;
  depositType: InvestorDepositType;
  date: Date;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
  proofFileUrl?: string;
  tenantId?: string;
}

export class InvestorDepositService {
  constructor(
    private readonly depositRepo: InvestorDepositRepository = new InvestorDepositRepository(),
  ) {}

  /** Membuat deposit investor baru dengan status PENDING. */
  async createDeposit(input: CreateDepositInput) {
    return this.depositRepo.create({
      investorId: input.investorId,
      amount: input.amount,
      depositType: input.depositType,
      date: input.date,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      reference: input.reference,
      notes: input.notes,
      proofFileUrl: input.proofFileUrl,
      tenantId: input.tenantId,
    });
  }

  /** Verifikasi deposit: PENDING → VERIFIED. */
  async verifyDeposit(id: string, verifiedById: string) {
    const deposit = await this.depositRepo.findById(id);
    if (!deposit) throw new Error("Deposit tidak ditemukan");
    if (deposit.status !== "PENDING") {
      throw new Error(
        `Deposit tidak bisa diverifikasi, status saat ini: ${deposit.status}`,
      );
    }

    return this.depositRepo.updateStatus(id, {
      status: "VERIFIED",
      verifiedAt: new Date(),
      verifiedById,
    });
  }

  /** Selesaikan deposit: VERIFIED → COMPLETED, publish event untuk jurnal akuntansi. */
  async completeDeposit(id: string) {
    const deposit = await this.depositRepo.findById(id);
    if (!deposit) throw new Error("Deposit tidak ditemukan");
    if (deposit.status !== "VERIFIED") {
      throw new Error(
        `Deposit tidak bisa diselesaikan, status saat ini: ${deposit.status}`,
      );
    }

    const completed = await this.depositRepo.updateStatus(id, {
      status: "COMPLETED",
      completedAt: new Date(),
    });

    // Publish event untuk auto-journal di accounting module
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus
      .publish(EVENT_NAMES.INVESTOR_DEPOSIT_COMPLETED, {
        depositId: completed.id,
        investorId: completed.investorId,
        tenantId: completed.tenantId ?? "",
        amount: String(completed.amount),
        depositType: completed.depositType,
        completedAt: new Date().toISOString(),
      })
      .catch(() => {});

    return completed;
  }

  /** Tolak deposit: status → REJECTED. */
  async rejectDeposit(id: string, reason: string) {
    const deposit = await this.depositRepo.findById(id);
    if (!deposit) throw new Error("Deposit tidak ditemukan");
    if (deposit.status === "COMPLETED") {
      throw new Error("Deposit yang sudah COMPLETED tidak bisa ditolak");
    }

    return this.depositRepo.updateStatus(id, {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedReason: reason,
    });
  }

  /** Mengambil daftar deposit berdasarkan investor. */
  async listByInvestor(
    investorId: string,
    filter?: { status?: InvestorDepositStatus },
  ) {
    return this.depositRepo.listByInvestor(investorId, filter);
  }

  /** Mengambil daftar deposit PENDING untuk approval queue. */
  async listPending(tenantId: string) {
    return this.depositRepo.listPending(tenantId);
  }

  /** Mengambil semua deposit untuk tenant, opsional filter by status. */
  async listAllByTenant(
    tenantId: string,
    filter?: { status?: InvestorDepositStatus },
  ) {
    return this.depositRepo.listAll(tenantId, filter);
  }
}
