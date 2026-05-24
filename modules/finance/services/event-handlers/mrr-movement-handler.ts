import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import { getMRRMovementService } from "../MRRMovementService";

/**
 * Handler untuk CUSTOMER_ACTIVATED.
 * - Jika oldStatus PENDING/baru → NEW movement
 * - Jika oldStatus SUSPENDED/ISOLATED → REACTIVATION movement
 */
export async function handleCustomerActivatedMrr(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const { customerId, customerName, oldStatus, tenantId } = payload as {
    customerId: string;
    customerName?: string;
    oldStatus?: string;
    tenantId?: string;
  };

  const service = getMRRMovementService();
  const mrr = await service.getCurrentCustomerMRR(customerId);
  if (mrr <= 0n) return;

  const isReactivation =
    oldStatus === "SUSPENDED" ||
    oldStatus === "ISOLATED" ||
    oldStatus === "INACTIVE";

  await service.recordMovement({
    movementType: isReactivation ? "REACTIVATION" : "NEW",
    pelangganId: customerId,
    amount: mrr,
    description: `${customerName ?? customerId} ${
      isReactivation ? "reactivated" : "activated"
    } from ${oldStatus ?? "—"}`,
    tenantId: tenantId ?? null,
  });

  logger.info(
    `[MRRMovement] ${isReactivation ? "REACTIVATION" : "NEW"} ${customerId} ${mrr}`,
  );
}

/**
 * Handler untuk CUSTOMER_SUSPENDED, CUSTOMER_ISOLATED, CUSTOMER_DELETED.
 * Tulis CHURN movement dengan amount negatif (current MRR pelanggan saat itu).
 */
export async function handleCustomerChurnedMrr(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const { customerId, customerName, tenantId } = payload as {
    customerId: string;
    customerName?: string;
    tenantId?: string;
  };

  const service = getMRRMovementService();
  const mrr = await service.getCurrentCustomerMRR(customerId);
  if (mrr <= 0n) return;

  await service.recordMovement({
    movementType: "CHURN",
    pelangganId: customerId,
    amount: -mrr,
    description: `${customerName ?? customerId} churned`,
    tenantId: tenantId ?? null,
  });

  logger.info(`[MRRMovement] CHURN ${customerId} ${-mrr}`);
}

/**
 * Handler untuk PACKAGE_CHANGED.
 * - Jika new > old → EXPANSION (delta positif)
 * - Jika new < old → CONTRACTION (delta negatif)
 * - Jika new === old → skip
 */
export async function handlePackageChangedMrr(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const {
    customerId,
    customerName,
    oldPackagePrice,
    newPackagePrice,
    tenantId,
  } = payload as {
    customerId: string;
    customerName?: string;
    oldPackagePrice: number;
    newPackagePrice: number;
    tenantId?: string;
  };

  const delta = BigInt(newPackagePrice) - BigInt(oldPackagePrice);
  if (delta === 0n) return;

  const service = getMRRMovementService();
  await service.recordMovement({
    movementType: delta > 0n ? "EXPANSION" : "CONTRACTION",
    pelangganId: customerId,
    amount: delta,
    description: `${customerName ?? customerId} package changed: ${oldPackagePrice} → ${newPackagePrice}`,
    tenantId: tenantId ?? null,
  });

  logger.info(
    `[MRRMovement] ${delta > 0n ? "EXPANSION" : "CONTRACTION"} ${customerId} ${delta}`,
  );
}
