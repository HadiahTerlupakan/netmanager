import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { EventJobData } from "@/lib/event-bus/queues";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import { OnuControlService } from "../OnuControlService";

const SYSTEM_USER_ID = "system";
const onuControl = new OnuControlService();

/**
 * Sinkronisasi status ONU saat lifecycle pelanggan berubah.
 * Suspend → disable ONU di OLT.
 * Activate → enable ONU di OLT.
 *
 * Idempotent: kalau ONU sudah dalam status tujuan, OnuControlService
 * akan kirim command tapi DB stay konsisten.
 */
export async function handlePelangganStatusForOlt(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const customerId = (payload as { customerId?: string })?.customerId;
  if (!customerId) {
    logger.warn(`[OltEvent] customerId missing in payload for ${eventName}`);
    return;
  }

  const onu = await findOnuByPelanggan(customerId);
  if (!onu) {
    logger.debug(
      `[OltEvent] No ONU bound to pelanggan ${customerId}, skip ${eventName}`,
    );
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_SUSPENDED) {
    logger.info(
      `[OltEvent] Pelanggan ${customerId} suspended → disabling ONU ${onu.serialNumber}`,
    );
    const result = await onuControl.disableOnu(
      onu.id,
      onu.tenantId,
      SYSTEM_USER_ID,
    );
    if (!result.success) {
      throw new Error(`Disable ONU ${onu.serialNumber} gagal: ${result.error}`);
    }
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_ACTIVATED) {
    logger.info(
      `[OltEvent] Pelanggan ${customerId} activated → enabling ONU ${onu.serialNumber}`,
    );
    const result = await onuControl.enableOnu(
      onu.id,
      onu.tenantId,
      SYSTEM_USER_ID,
    );
    if (!result.success) {
      throw new Error(`Enable ONU ${onu.serialNumber} gagal: ${result.error}`);
    }
  }
}

async function findOnuByPelanggan(pelangganId: string) {
  return prisma.onuDevice.findFirst({
    where: { pelangganId, status: { in: ["ACTIVE", "DISABLED"] } },
    select: { id: true, tenantId: true, serialNumber: true },
  });
}
