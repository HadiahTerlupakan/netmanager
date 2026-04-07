import type { CreateWorkOrderData } from "../repositories/IWorkOrderRepository";
import type { WarrantyCheckRepository } from "../repositories/WorkOrderSupportRepositories";
import type { CreateWorkOrderInput, UserContext } from "./WorkOrderService";
import { isSuperAdminContext } from "./work-order-access";

type WorkOrderWarrantyRepository = Pick<
  WarrantyCheckRepository,
  "findLastCompletedWoByMitra" | "findMitraById"
>;

export async function prepareWorkOrderCreateData(params: {
  input: CreateWorkOrderInput;
  userContext: UserContext;
  warrantyRepo: WorkOrderWarrantyRepository;
}): Promise<CreateWorkOrderData> {
  const { input, userContext, warrantyRepo } = params;
  const {
    permissions = [],
    siteId: userSiteId,
    departmentId: userDeptId,
    id: createdById,
  } = userContext;
  const isSuperAdmin = isSuperAdminContext(userContext);

  if (!input.type || !input.title || !input.description) {
    throw new Error("Tipe, judul, dan deskripsi wajib diisi");
  }

  const normalizedInput: CreateWorkOrderInput = { ...input };

  if (permissions.includes("workorders:site_only") && !isSuperAdmin) {
    if (normalizedInput.siteId && normalizedInput.siteId !== userSiteId) {
      throw new Error(
        "Akses ditolak: Anda hanya dapat membuat work order untuk site Anda",
      );
    }
    normalizedInput.siteId = userSiteId;
  }

  if (permissions.includes("workorders:department_only") && !isSuperAdmin) {
    if (
      normalizedInput.departmentId &&
      normalizedInput.departmentId !== userDeptId
    ) {
      throw new Error(
        "Akses ditolak: Anda hanya dapat membuat work order untuk departemen Anda",
      );
    }
    normalizedInput.departmentId = userDeptId;
  }

  const { scheduledDate: rawScheduledDate, ...restInput } = normalizedInput;
  let createData: CreateWorkOrderData & {
    isWarranty?: boolean;
    warrantyOwnerId?: string;
    warrantySla?: Date;
  } = {
    ...restInput,
    createdById,
    ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
  };

  if (
    normalizedInput.pelangganId &&
    (normalizedInput.type === "TROUBLESHOOT" ||
      normalizedInput.type === "MAINTENANCE")
  ) {
    const lastCompletedWo = await warrantyRepo.findLastCompletedWoByMitra(
      normalizedInput.pelangganId,
    );

    if (lastCompletedWo?.assignedMitraId && lastCompletedWo.completedAt) {
      const mitra = await warrantyRepo.findMitraById(
        lastCompletedWo.assignedMitraId,
      );
      const garansiHari = mitra?.garansiHari || 0;

      if (mitra && garansiHari > 0) {
        const garansiMs = garansiHari * 24 * 60 * 60 * 1000;
        const expirationDate = new Date(
          lastCompletedWo.completedAt.getTime() + garansiMs,
        );

        if (new Date() <= expirationDate) {
          const slaJam = mitra.slaGaransiJam || 24;
          const slaMs = slaJam * 60 * 60 * 1000;

          createData = {
            ...createData,
            isWarranty: true,
            warrantyOwnerId: mitra.id,
            warrantySla: new Date(Date.now() + slaMs),
          };
        }
      }
    }
  }

  return createData;
}
