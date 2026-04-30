import { logger } from "@/lib/logger";
import { prismaMitra } from "@/modules/database";

import type {
  MitraWalletServiceContract,
  WorkOrderActionExecutionInput,
} from "./work-order-mobile-action.types";

const DEFAULT_PENALTY_AMOUNT = 50000;

export async function processMitraCommission(
  input: WorkOrderActionExecutionInput,
) {
  try {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id: input.input.actor.id },
      select: {
        mitraType: true,
        mitraRateWoPsb: true,
        mitraRateWoMaintenance: true,
      },
    });

    if (mitra?.mitraType !== "MITRA_TEKNISI") return;

    const { getMitraWalletService } = await import("@/modules/mitra");
    await applyWarrantyCommission(input, mitra, getMitraWalletService());
  } catch (error) {
    logger.error("[MitraCommission] Error:", error as Error);
  }
}

async function applyWarrantyCommission(
  input: WorkOrderActionExecutionInput,
  mitra: {
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
  },
  walletService: MitraWalletServiceContract,
) {
  const ticketNumber = getTicketNumber(input);
  const rate = getMitraRate(input, mitra);

  if (input.workOrder?.isWarranty && input.workOrder.warrantyOwnerId) {
    await handleWarrantyCommission(input, walletService, rate, ticketNumber);
    return;
  }

  if (rate <= 0) return;

  await walletService.addEarning(
    input.input.actor.id,
    rate,
    `Komisi WO #${ticketNumber} (${input.workOrder?.type})`,
    input.input.workOrderId,
    "WORK_ORDER",
  );
}

async function handleWarrantyCommission(
  input: WorkOrderActionExecutionInput,
  walletService: MitraWalletServiceContract,
  rate: number,
  ticketNumber: string,
) {
  if (input.workOrder?.warrantyOwnerId === input.input.actor.id) {
    await addSelfWarrantyEarning(input, walletService, ticketNumber);
    return;
  }

  await addWarrantyAuctionEarning(input, walletService, rate, ticketNumber);
  await deductWarrantyOwnerPenalty(input, walletService, ticketNumber);
}

async function addSelfWarrantyEarning(
  input: WorkOrderActionExecutionInput,
  walletService: MitraWalletServiceContract,
  ticketNumber: string,
) {
  await walletService.addEarning(
    input.input.actor.id,
    0,
    `Pengerjaan Garansi Mandiri #${ticketNumber}`,
    input.input.workOrderId,
    "WORK_ORDER",
  );
}

async function addWarrantyAuctionEarning(
  input: WorkOrderActionExecutionInput,
  walletService: MitraWalletServiceContract,
  rate: number,
  ticketNumber: string,
) {
  if (rate <= 0) return;

  await walletService.addEarning(
    input.input.actor.id,
    rate,
    `Komisi WO #${ticketNumber} (${input.workOrder?.type}) - Lelang Garansi`,
    input.input.workOrderId,
    "WORK_ORDER",
  );
}

async function deductWarrantyOwnerPenalty(
  input: WorkOrderActionExecutionInput,
  walletService: MitraWalletServiceContract,
  ticketNumber: string,
) {
  const warrantyOwnerId = input.workOrder?.warrantyOwnerId || "";
  const originalOwner = await prismaMitra.mitra.findUnique({
    where: { id: warrantyOwnerId },
    select: { penaltyPsb: true },
  });

  await walletService.deductBalance(
    warrantyOwnerId,
    originalOwner?.penaltyPsb || DEFAULT_PENALTY_AMOUNT,
    `Denda Garansi SLA #${ticketNumber}`,
    input.input.workOrderId,
    "WORK_ORDER",
  );
}

function getTicketNumber(input: WorkOrderActionExecutionInput) {
  return (
    input.workOrder?.ticket?.ticketNumber ||
    input.workOrder?.workOrderNumber ||
    input.input.workOrderId
  );
}

function getMitraRate(
  input: WorkOrderActionExecutionInput,
  mitra: {
    mitraRateWoPsb: number | null;
    mitraRateWoMaintenance: number | null;
  },
) {
  return input.workOrder?.type === "INSTALLATION"
    ? mitra.mitraRateWoPsb || 0
    : mitra.mitraRateWoMaintenance || 0;
}
