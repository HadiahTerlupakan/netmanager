import type { Prisma } from "@prisma/client-billing";
import { PaymentRepository } from "../../repositories/PaymentRepository";
import { UnmatchedMutationRepository } from "../../repositories/UnmatchedMutationRepository";
import type { WebhookResult } from "./provider-interface";
import { asRecord, asString, parseDateOrNow } from "./webhook-utils";

export type SupportedWebhookProvider =
  | "XENDIT"
  | "MIDTRANS"
  | "TRIPAY"
  | "DUITKU"
  | "BRI"
  | "BCA"
  | "DANA"
  | "MOOTA";

/** Mengelola lookup payment dan pencatatan unmatched mutation dari webhook. */
export class WebhookPaymentLookupService {
  constructor(
    private readonly paymentRepository = new PaymentRepository(),
    private readonly unmatchedMutationRepository = new UnmatchedMutationRepository(),
  ) {}

  /** Cari payment memakai order ID awal dari payload mentah. */
  async findPaymentByEarlyOrderId(input: EarlyPaymentLookupInput) {
    const earlyOrderId = extractEarlyOrderId(input.providerType, input.payload);
    if (!earlyOrderId || input.providerType === "MOOTA") {
      return null;
    }

    return this.paymentRepository.findFirstAuth(
      buildPaymentLookupWhere(earlyOrderId, input.tenantId),
    );
  }

  /** Cari payment memakai order ID hasil parsing provider. */
  async findPaymentAfterWebhook(input: ParsedPaymentLookupInput) {
    if (input.providerType === "MOOTA") {
      return null;
    }

    return this.paymentRepository.findFirstAuth(
      buildPaymentLookupWhere(input.webhookResult.orderId, input.tenantId),
    );
  }

  /** Simpan mutasi Moota yang belum match ke payment manapun. */
  async recordUnmatchedMutationForMoota(
    providerType: SupportedWebhookProvider,
    webhookResult: WebhookResult,
  ) {
    if (providerType !== "MOOTA" || !webhookResult.raw) {
      return;
    }

    const rawData = asRecord(webhookResult.raw);
    const mutationId = asString(rawData.mutation_id);
    if (!mutationId) {
      return;
    }

    const existing =
      await this.unmatchedMutationRepository.findByTransactionId(mutationId);
    if (existing) {
      return;
    }

    const amount = Number(rawData.amount);
    if (Number.isNaN(amount)) {
      return;
    }

    await this.unmatchedMutationRepository.create({
      provider: "MOOTA",
      transactionId: mutationId,
      amount,
      description: asString(rawData.description) || "Mutasi masuk dari Moota",
      type: asString(rawData.type) || "CR",
      date: parseDateOrNow(rawData.date),
      bankId: asString(rawData.bank_id),
      rawPayload: JSON.parse(JSON.stringify(rawData)),
      status: "PENDING",
    });
  }
}

type EarlyPaymentLookupInput = {
  providerType: SupportedWebhookProvider;
  payload: Record<string, unknown>;
  tenantId?: string | null;
};

type ParsedPaymentLookupInput = {
  providerType: SupportedWebhookProvider;
  webhookResult: WebhookResult;
  tenantId?: string | null;
};

function extractEarlyOrderId(
  providerType: SupportedWebhookProvider,
  payload: Record<string, unknown>,
) {
  const reader = (field: string): string | undefined => {
    const value = payload[field];
    return typeof value === "string" && value.trim().length > 0
      ? value
      : undefined;
  };

  switch (providerType) {
    case "MIDTRANS":
      return reader("order_id");
    case "XENDIT":
      return reader("external_id");
    case "TRIPAY":
      return reader("merchant_ref");
    case "DUITKU":
      return reader("merchantOrderId");
    case "BRI":
      return reader("custCode") || reader("brivaNo");
    case "BCA":
      return reader("CustomerID") || reader("TransactionID");
    case "DANA":
      return reader("merchantOrderId") || reader("orderId");
    case "MOOTA":
      return undefined;
  }
}

function buildPaymentLookupWhere(
  reference: string | undefined,
  tenantId?: string | null,
): Prisma.PaymentWhereInput {
  const paymentReference = reference ?? "__missing_reference__";

  if (!tenantId) {
    return { reference: paymentReference };
  }

  return { reference: paymentReference, tenantId };
}
