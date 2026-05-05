type MaterialReturnItem = {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: string;
  barangId: string;
  gudangId: string;
};

export type MaterialReturnActivityInput = {
  userId: string;
  tenantId?: string;
  workOrderId: string;
  workOrderNumber: string;
  items: MaterialReturnItem[];
};

type MaterialReturnActivityDetails = {
  workOrderId: string;
  workOrderNumber: string;
  items: MaterialReturnItem[];
};

type MaterialReturnActivityEntry = {
  action: "CREATE";
  subject: "MaterialReturn";
  userId: string;
  tenantId?: string;
  details: MaterialReturnActivityDetails;
};

const MATERIAL_RETURN_ACTIVITY_ACTION = "CREATE";
const MATERIAL_RETURN_ACTIVITY_SUBJECT = "MaterialReturn";

export function buildMaterialReturnActivityEntry(
  input: MaterialReturnActivityInput,
): MaterialReturnActivityEntry {
  return {
    action: MATERIAL_RETURN_ACTIVITY_ACTION,
    subject: MATERIAL_RETURN_ACTIVITY_SUBJECT,
    userId: input.userId,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    details: buildMaterialReturnActivityDetails(input),
  };
}

function buildMaterialReturnActivityDetails(
  input: MaterialReturnActivityInput,
): MaterialReturnActivityDetails {
  return {
    workOrderId: input.workOrderId,
    workOrderNumber: input.workOrderNumber,
    items: input.items,
  };
}
