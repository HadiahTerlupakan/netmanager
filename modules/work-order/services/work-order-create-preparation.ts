import type { CreateWorkOrderData } from "../domain/ports/IWorkOrderRepository";

type WorkOrderCreateDataWithWarranty = CreateWorkOrderData & {
  isWarranty?: boolean;
  warrantyOwnerId?: string;
  warrantySla?: Date;
};
import type { WarrantyCheckRepository } from "../repositories/WorkOrderSupportRepositories";
import type { CreateWorkOrderInput, UserContext } from "./WorkOrderService";
import { isSuperAdminContext } from "./work-order-access";
import {
  enforceDepartmentRestriction,
  enforceSiteRestriction,
} from "./work-order-create-scope";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_WARRANTY_SLA_HOURS = 24;

type WorkOrderWarrantyRepository = Pick<
  WarrantyCheckRepository,
  "findLastCompletedWoByMitra" | "findMitraById"
>;

type PrepareWorkOrderCreateDataParams = {
  input: CreateWorkOrderInput;
  userContext: UserContext;
  warrantyRepo: WorkOrderWarrantyRepository;
};

/** Prepare sanitized create payload for work order creation. */
export async function prepareWorkOrderCreateData(
  params: PrepareWorkOrderCreateDataParams,
): Promise<CreateWorkOrderData> {
  validateRequiredCreateFields(params.input);

  const normalizedInput = applyUserScopeRestrictions(params);
  const baseCreateData = buildBaseCreateData(
    normalizedInput,
    params.userContext.id,
  );

  return enrichWarrantyCreateData({
    createData: baseCreateData,
    input: normalizedInput,
    warrantyRepo: params.warrantyRepo,
  });
}

function validateRequiredCreateFields(input: CreateWorkOrderInput): void {
  if (!input.type || !input.title || !input.description) {
    throw new Error("Tipe, judul, dan deskripsi wajib diisi");
  }
}

function applyUserScopeRestrictions(
  params: PrepareWorkOrderCreateDataParams,
): CreateWorkOrderInput {
  const { input, userContext } = params;
  const normalizedInput: CreateWorkOrderInput = { ...input };
  const isSuperAdmin = isSuperAdminContext(userContext);

  enforceSiteRestriction({ normalizedInput, userContext, isSuperAdmin });
  enforceDepartmentRestriction({ normalizedInput, userContext, isSuperAdmin });

  return normalizedInput;
}

function buildBaseCreateData(
  input: CreateWorkOrderInput,
  createdById: string,
): CreateWorkOrderData {
  const { scheduledDate: rawScheduledDate, ...restInput } = input;

  return {
    ...restInput,
    createdById,
    ...(rawScheduledDate ? { scheduledDate: new Date(rawScheduledDate) } : {}),
  };
}

async function enrichWarrantyCreateData(params: {
  createData: WorkOrderCreateDataWithWarranty;
  input: CreateWorkOrderInput;
  warrantyRepo: WorkOrderWarrantyRepository;
}): Promise<CreateWorkOrderData> {
  const { createData, input, warrantyRepo } = params;
  if (!canCheckWarranty(input)) {
    return createData;
  }

  const warrantyOwner = await findActiveWarrantyOwner(
    input.pelangganId,
    warrantyRepo,
  );
  if (!warrantyOwner) {
    return createData;
  }

  return buildWarrantyCreateData(createData, warrantyOwner);
}

async function findActiveWarrantyOwner(
  pelangganId: string,
  warrantyRepo: WorkOrderWarrantyRepository,
) {
  const lastCompletedWorkOrder =
    await warrantyRepo.findLastCompletedWoByMitra(pelangganId);
  if (
    !lastCompletedWorkOrder?.assignedMitraId ||
    !lastCompletedWorkOrder.completedAt
  ) {
    return null;
  }

  const mitra = await warrantyRepo.findMitraById(
    lastCompletedWorkOrder.assignedMitraId,
  );
  if (
    !mitra ||
    !hasActiveWarrantyWindow(
      mitra.garansiHari || 0,
      lastCompletedWorkOrder.completedAt,
    )
  ) {
    return null;
  }

  return mitra;
}

function buildWarrantyCreateData(
  createData: WorkOrderCreateDataWithWarranty,
  mitra: { id: string; slaGaransiJam?: number | null },
): CreateWorkOrderData {
  return {
    ...createData,
    isWarranty: true,
    warrantyOwnerId: mitra.id,
    warrantySla: new Date(
      Date.now() + resolveWarrantySlaMs(mitra.slaGaransiJam),
    ),
  } as CreateWorkOrderData;
}

function canCheckWarranty(
  input: CreateWorkOrderInput,
): input is CreateWorkOrderInput & {
  pelangganId: string;
} {
  return Boolean(
    input.pelangganId &&
    (input.type === "TROUBLESHOOT" || input.type === "MAINTENANCE"),
  );
}

function hasActiveWarrantyWindow(
  warrantyDays: number,
  completedAt: Date,
): boolean {
  if (warrantyDays <= 0) {
    return false;
  }

  const expirationDate = new Date(
    completedAt.getTime() + warrantyDays * MILLISECONDS_PER_DAY,
  );
  return new Date() <= expirationDate;
}

function resolveWarrantySlaMs(slaHours?: number | null): number {
  return (slaHours || DEFAULT_WARRANTY_SLA_HOURS) * MILLISECONDS_PER_HOUR;
}
