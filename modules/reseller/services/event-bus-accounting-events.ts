import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { resellerCommissionAccrualRef } from "@/lib/event-bus/types";
import { logger } from "@/lib/logger";
import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";
import type { IResellerAccountingEvents } from "../domain/ports/IResellerAccountingEvents";

const SOURCE = "[ResellerAccountingEvents]";

/**
 * Kirim event akuntansi komisi reseller ke modul accounting. Data tanpa
 * tenant tidak dikirim: handler jurnal wajib bertenant, dan jurnal tanpa
 * tenant bisa masuk buku tenant lain di system context.
 */
export class EventBusResellerAccountingEvents implements IResellerAccountingEvents {
  /** Publish RESELLER_COMMISSION_ACCRUED. */
  async commissionAccrued(commission: ResellerCommissionEntity): Promise<void> {
    const tenantId = requireTenant(commission.tenantId, commission.id);
    if (!tenantId) return;
    await publishSafely(EVENT_NAMES.RESELLER_COMMISSION_ACCRUED, {
      tenantId,
      commissionId: commission.id,
      accrualRef: accrualRefOf(commission),
      resellerId: commission.resellerId,
      invoiceId: commission.invoiceId,
      amount: commission.commissionAmount,
      accruedAt: commission.accruedAt.toISOString(),
    });
  }

  /** Publish RESELLER_COMMISSION_CANCELLED. */
  async commissionCancelled(
    commission: ResellerCommissionEntity,
  ): Promise<void> {
    const tenantId = requireTenant(commission.tenantId, commission.id);
    if (!tenantId) return;
    await publishSafely(EVENT_NAMES.RESELLER_COMMISSION_CANCELLED, {
      tenantId,
      commissionId: commission.id,
      accrualRef: accrualRefOf(commission),
      invoiceId: commission.invoiceId,
      cancelledAt: (commission.deletedAt ?? new Date()).toISOString(),
    });
  }

  /** Publish RESELLER_COMMISSION_CLAWED_BACK. */
  async commissionClawedBack(
    adjustment: ResellerCommissionAdjustmentEntity,
  ): Promise<void> {
    const tenantId = requireTenant(adjustment.tenantId, adjustment.id);
    if (!tenantId) return;
    await publishSafely(EVENT_NAMES.RESELLER_COMMISSION_CLAWED_BACK, {
      tenantId,
      adjustmentId: adjustment.id,
      commissionId: adjustment.sourceCommissionId,
      resellerId: adjustment.resellerId,
      invoiceId: adjustment.invoiceId,
      amount: adjustment.amount,
      recordedAt: adjustment.createdAt.toISOString(),
    });
  }

  /** Publish RESELLER_SETTLEMENT_PAID. */
  async settlementPaid(settlement: ResellerSettlementEntity): Promise<void> {
    const tenantId = requireTenant(settlement.tenantId, settlement.id);
    if (!tenantId || !settlement.paidAt || !settlement.paymentAccountId) return;
    await publishSafely(EVENT_NAMES.RESELLER_SETTLEMENT_PAID, {
      tenantId,
      settlementId: settlement.id,
      resellerId: settlement.resellerId,
      amount: settlement.totalAmount,
      paidAt: settlement.paidAt.toISOString(),
      accountId: settlement.paymentAccountId,
    });
  }
}

/**
 * Ref jurnal akru. Komisi yang dibatalkan lalu dipulihkan mendapat
 * `accruedAt` baru, jadi ref baru: jurnal akru lamanya tetap terbalik dan
 * akrual barunya tidak tertahan kunci idempotensi jurnal lama.
 */
function accrualRefOf(commission: ResellerCommissionEntity): string {
  return resellerCommissionAccrualRef(commission.id, commission.accruedAt);
}

function requireTenant(tenantId: string | null, refId: string): string | null {
  if (tenantId) return tenantId;
  logger.warn(`${SOURCE} ${refId} tanpa tenant; jurnal komisi tidak dikirim`);
  return null;
}

async function publishSafely(
  ...args: Parameters<typeof eventBus.publish>
): Promise<void> {
  try {
    await eventBus.publish(...args);
  } catch (error) {
    logger.error(`${SOURCE} Gagal mengirim ${args[0]}:`, error);
  }
}
