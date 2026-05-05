import { prismaMitra } from "@/modules/database";
import { getMitraWalletService } from "@/modules/mitra";
import type { PointClaimEntity } from "../domain/entities/PointClaimEntity";

const CANVASING_SOURCE = "CANVASING" as const;
const MITRA_SALES_TYPE = "MITRA_SALES" as const;

export async function addMitraCommissionIfEligible(
  claim: PointClaimEntity,
  fallbackSourceId: string,
): Promise<void> {
  const salesMitra = await prismaMitra.mitra.findUnique({
    where: { id: claim.salesId },
    select: { mitraType: true, mitraRateCanvasing: true },
  });

  if (!salesMitra?.mitraRateCanvasing) {
    return;
  }

  if (salesMitra.mitraType !== MITRA_SALES_TYPE) {
    return;
  }

  const walletService = getMitraWalletService();
  await walletService.addEarning(
    claim.salesId,
    salesMitra.mitraRateCanvasing,
    `Komisi Canvasing #${claim.canvasingId || fallbackSourceId}`,
    claim.canvasingId || fallbackSourceId,
    CANVASING_SOURCE,
  );
}
