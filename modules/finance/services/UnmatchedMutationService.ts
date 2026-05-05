import type { Prisma } from "../lib/billing-prisma-boundary";
import type { Payment, UnmatchedMutation } from "../types/invoice.enums";
import { BillingRepository } from "../repositories/BillingRepository";
import { UnmatchedMutationRepository } from "../repositories/UnmatchedMutationRepository";

export class UnmatchedMutationNotFoundError extends Error {}
export class InvoiceNotFoundError extends Error {}
export class MissingInvoiceIdError extends Error {}

export interface ListUnmatchedMutationParams {
  status?: "PENDING" | "RESOLVED" | "IGNORED" | "ALL";
  page?: number;
  limit?: number;
}

export interface ResolveMutationParams {
  mutationId: string;
  invoiceId?: string;
  userId: string;
}

export class UnmatchedMutationService {
  constructor(
    private readonly unmatchedRepo = new UnmatchedMutationRepository(),
    private readonly billingRepo = new BillingRepository(),
  ) {}

  async list(params: ListUnmatchedMutationParams): Promise<{
    total: number;
    mutations: UnmatchedMutation[];
    page: number;
    limit: number;
  }> {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.max(params.limit ?? 10, 1);
    const skip = (page - 1) * limit;

    const where: Prisma.UnmatchedMutationWhereInput = {};
    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    const [total, mutations] = await Promise.all([
      this.unmatchedRepo.count(where),
      this.unmatchedRepo.findMany(where, {
        skip,
        take: limit,
        orderBy: { date: "desc" },
      }),
    ]);

    return { total, mutations, page, limit };
  }

  async ignore(mutationId: string, userId: string): Promise<UnmatchedMutation> {
    const mutation = await this.unmatchedRepo.findById(mutationId);
    if (!mutation) {
      throw new UnmatchedMutationNotFoundError("Mutation not found");
    }

    return this.unmatchedRepo.update(mutationId, {
      status: "IGNORED",
      resolvedAt: new Date(),
      resolvedById: userId,
    });
  }

  async resolve(
    params: ResolveMutationParams,
  ): Promise<{ payment: Payment; mutation: UnmatchedMutation }> {
    if (!params.invoiceId) {
      throw new MissingInvoiceIdError("Invoice ID required for resolving");
    }

    const mutation = await this.unmatchedRepo.findById(params.mutationId);
    if (!mutation) {
      throw new UnmatchedMutationNotFoundError("Mutation not found");
    }

    const invoice = await this.billingRepo.findInvoiceById(params.invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundError("Invoice not found");
    }

    const payment = await this.billingRepo.createPayment({
      id: `PAY-${Date.now()}`,
      amount: BigInt(mutation.amount.toString()),
      paymentDate: mutation.date,
      paymentMethod: "BANK_TRANSFER",
      notes: `Resolved from unmatched mutation ${mutation.transactionId ?? mutation.id}`,
      verifiedBy: params.userId || "SYSTEM",
      verifiedAt: new Date(),
      transactionId: mutation.transactionId ?? undefined,
      gatewayStatus: "PAID",
      gatewayProvider: mutation.provider,
      pelangganId: invoice.pelangganId,
      invoice: { connect: { id: invoice.id } },
      unmatchedMutation: { connect: { id: mutation.id } },
      updatedAt: new Date(),
    });

    const updatedMutation = await this.unmatchedRepo.update(params.mutationId, {
      status: "RESOLVED",
      matchedInvoiceId: invoice.id,
      resolvedAt: new Date(),
      resolvedById: params.userId,
    });

    return { payment, mutation: updatedMutation };
  }
}
