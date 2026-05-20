import { logger } from "@/lib/logger";
import { OnuControlService } from "../OnuControlService";

const onuControl = new OnuControlService();

export async function handlePelangganSuspended(payload: {
  pelangganId: string;
}) {
  const onu = await findOnuByPelanggan(payload.pelangganId);
  if (!onu) return;

  logger.info(
    `[OltEvent] Pelanggan ${payload.pelangganId} suspended → disabling ONU ${onu.serialNumber}`,
  );
  await onuControl.disableOnu(onu.id, "system");
}

export async function handlePelangganActivated(payload: {
  pelangganId: string;
}) {
  const onu = await findOnuByPelanggan(payload.pelangganId);
  if (!onu) return;

  logger.info(
    `[OltEvent] Pelanggan ${payload.pelangganId} activated → enabling ONU ${onu.serialNumber}`,
  );
  await onuControl.enableOnu(onu.id, "system");
}

async function findOnuByPelanggan(pelangganId: string) {
  const { prisma } = await import("@/modules/database");
  const onu = await prisma.onuDevice.findFirst({
    where: { pelangganId, status: { in: ["ACTIVE", "DISABLED"] } },
  });
  return onu;
}
