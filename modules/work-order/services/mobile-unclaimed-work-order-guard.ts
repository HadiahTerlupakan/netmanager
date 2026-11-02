import { getMobileAvailableWorkOrderService } from "./MobileAvailableWorkOrderService";
import type { UnclaimedWorkOrderAccessGuard } from "./work-order-access";

/**
 * Guard kelayakan WO yang belum diambil untuk jalur mobile: memakai aturan
 * yang sama dengan daftar WO tersedia (`MobileAvailableWorkOrderService`),
 * sehingga detail dan aksi CLAIM tidak lebih longgar daripada daftarnya.
 */
export const mobileUnclaimedWorkOrderGuard: UnclaimedWorkOrderAccessGuard = (
  workOrder,
  userContext,
) =>
  getMobileAvailableWorkOrderService().canAccessUnclaimedWorkOrder(
    { siteId: workOrder.siteId, departmentId: workOrder.departmentId },
    {
      id: userContext.id,
      role: userContext.role,
      tenantId: userContext.tenantId,
    },
  );
