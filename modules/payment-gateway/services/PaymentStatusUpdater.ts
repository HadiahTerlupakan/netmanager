import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import type { Prisma, GatewayPaymentStatus } from "@/modules/finance";
import type { WebhookResult } from "./provider-interface";
import {
  normalizePaymentMethod,
  hasTransactionMismatch,
} from "./webhook-utils";

export class PaymentStatusUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentStatusUpdateError";
  }
}

export class PaymentStatusUpdater {
  /**
   * Update payment status from webhook result
   */
  async updateFromWebhook(params: {
    paymentId: string;
    webhookResult: WebhookResult;
    gatewayStatus: GatewayPaymentStatus;
    providerType: string;
  }): Promise<void> {
    const { paymentId, webhookResult, gatewayStatus, providerType } = params;

    try {
      await prismaBillingAuth.$transaction(async (tx) => {
        // Re-check payment status to prevent race conditions
        const currentPayment = await tx.payment.findUnique({
          where: { id: paymentId },
        });

        if (!currentPayment) {
          throw new PaymentStatusUpdateError(`Payment ${paymentId} not found`);
        }

        // Already processed
        if (currentPayment.gatewayStatus === "PAID") {
          logger.info(
            `[PaymentStatusUpdater] Payment ${paymentId} already paid, skipping`,
          );
          return;
        }

        // Transaction ID mismatch
        if (
          hasTransactionMismatch(
            currentPayment.transactionId ?? null,
            webhookResult.transactionId,
          )
        ) {
          logger.warn(
            `[PaymentStatusUpdater] Transaction mismatch for payment ${paymentId}: expected ${currentPayment.transactionId}, received ${webhookResult.transactionId}`,
          );
          return;
        }

        // Build update data
        const paymentUpdate: Prisma.PaymentUpdateInput = {
          gatewayStatus,
          transactionId:
            webhookResult.transactionId || currentPayment.transactionId || null,
          gatewayProvider: providerType,
        };

        const normalizedPaymentMethod = normalizePaymentMethod(
          webhookResult.paymentMethod,
        );
        if (normalizedPaymentMethod) {
          paymentUpdate.paymentMethod = normalizedPaymentMethod;
        }

        if (webhookResult.paidAt) {
          paymentUpdate.paymentDate = webhookResult.paidAt;
        }

        // Update payment
        await tx.payment.update({
          where: { id: paymentId },
          data: paymentUpdate,
        });

        logger.info(
          `[PaymentStatusUpdater] Updated payment ${paymentId} to status ${gatewayStatus}`,
        );
      });
    } catch (error) {
      logger.error(
        `[PaymentStatusUpdater] Failed to update payment ${paymentId}:`,
        error,
      );
      throw error;
    }
  }
}
