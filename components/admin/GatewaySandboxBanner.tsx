import { getServerSession } from "next-auth";
import { HiExclamationTriangle } from "react-icons/hi2";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasAnyPermission } from "@/lib/rbac";
import {
  isSandboxGatewayLive,
  SANDBOX_GATEWAY_WARNING,
} from "@/modules/payment-gateway/api";

// Yang bisa menindaklanjutinya: pengelola konfigurasi gateway dan staf yang
// memverifikasi pembayaran. Pengguna admin lain tidak perlu melihatnya.
const SANDBOX_WARNING_PERMISSIONS = [
  "payment_gateway:read",
  "payment_gateway:update",
  "manual_payments:verify",
];

/**
 * Peringatan di seluruh portal admin, bagi pengelola pembayaran, selama
 * Duitku tenant ini memakai kredensial SANDBOX di produksi: halaman demo
 * sandbox Duitku bisa "membayar" VA mana pun, jadi tagihan lunas tanpa uang
 * yang masuk. Flag di health check internal tidak bergantung pada ini.
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
    if (!session?.user) return false;
    if (!(await hasAnyPermission(SANDBOX_WARNING_PERMISSIONS, session.user))) {
      return false;
    }
    return await isSandboxGatewayLive(session.user.tenantId ?? null);
  } catch (error) {
    logger.warn("[Admin] Gagal memeriksa gateway sandbox:", error);
    return false;
  }
}
