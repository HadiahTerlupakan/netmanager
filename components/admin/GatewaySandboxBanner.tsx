import { getServerSession } from "next-auth";
import { HiExclamationTriangle } from "react-icons/hi2";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  isSandboxGatewayLive,
  SANDBOX_GATEWAY_WARNING,
} from "@/modules/payment-gateway/api";

/**
 * Peringatan di seluruh portal admin selama Duitku tenant ini memakai
 * kredensial SANDBOX di produksi: halaman demo sandbox Duitku bisa
 * "membayar" VA mana pun, jadi tagihan lunas tanpa uang yang masuk.
 */
export default async function GatewaySandboxBanner() {
  if (!(await shouldWarn())) return null;

  return (
    <div
      role="alert"
      className="bg-red-700 text-white px-4 py-3 flex items-center gap-3 font-semibold"
    >
      <HiExclamationTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span>{SANDBOX_GATEWAY_WARNING}</span>
    </div>
  );
}

// Peringatan yang gagal diperiksa tidak boleh menjatuhkan seluruh halaman.
async function shouldWarn() {
  try {
    const session = await getServerSession(authOptions);
    return await isSandboxGatewayLive(session?.user?.tenantId ?? null);
  } catch (error) {
    logger.warn("[Admin] Gagal memeriksa gateway sandbox:", error);
    return false;
  }
}
