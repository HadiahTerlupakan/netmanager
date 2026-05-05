import { prisma } from "@/lib/prisma";
import {
  buildFallbackMaterialDetail,
  buildMatchedMaterialDetail,
  buildMinimalMaterialDetail,
  findMatchingMaterial,
  getSourceMaterials,
  parseMaterialMessage,
} from "./admin-work-order-material-detail.builders";

type MaterialUpdateRecord = Awaited<
  ReturnType<typeof prisma.workOrderUpdates.findUnique>
> & {
  user?: { id: string; name: string | null; email: string | null } | null;
  workOrders?: {
    workOrderNumber: string;
    usedMaterials: unknown;
    returnedMaterials: unknown;
  } | null;
};

export async function findWorkOrderMaterialDetail(input: {
  workOrderId: string;
  updateId: string;
}) {
  const update = await findMaterialUpdateRecord(input.updateId);
  const validationResult = validateMaterialDetailUpdate(
    update,
    input.workOrderId,
  );
  if (validationResult) {
    return validationResult;
  }

  return {
    code: "OK" as const,
    data: await buildMaterialDetail(update, input.updateId),
  };
}

async function findMaterialUpdateRecord(updateId: string) {
  return (await prisma.workOrderUpdates.findUnique({
    where: { id: updateId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      workOrders: {
        select: {
          workOrderNumber: true,
          usedMaterials: true,
          returnedMaterials: true,
        },
      },
    },
  })) as MaterialUpdateRecord | null;
}

function validateMaterialDetailUpdate(
  update: MaterialUpdateRecord | null,
  workOrderId: string,
) {
  if (!update) {
    return { code: "NOT_FOUND" as const };
  }
  if (update.workOrderId !== workOrderId) {
    return { code: "INVALID_WORK_ORDER" as const };
  }
  return null;
}

async function buildMaterialDetail(
  update: NonNullable<MaterialUpdateRecord>,
  updateId: string,
) {
  const message = update.message || "";
  const isPickup = update.updateType === "MATERIAL_PICKUP";
  const parsedMessage = parseMaterialMessage(message);
  const sourceMaterials = getSourceMaterials(update.workOrders, isPickup);

  if (!parsedMessage)
    return buildFallbackMaterialDetail(update, message, isPickup, updateId);

  const matchingMaterial = findMatchingMaterial(
    sourceMaterials,
    parsedMessage.namaBarang,
  );
  if (!matchingMaterial) {
    return buildMinimalMaterialDetail({
      update,
      message,
      isPickup,
      parsedMessage,
      updateId,
    });
  }

  return buildMatchedMaterialDetail({
    update,
    matchingMaterial,
    isPickup,
    parsedMessage,
    updateId,
  });
}
