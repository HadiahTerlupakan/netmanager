import { randomUUID } from "crypto";
import type { WorkOrderStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  appendUsedMaterialsToWorkOrder,
  createMaterialPickupMessage,
  createMobileMaterialUsage,
} from "./work-order-material.helpers";

type PrismaInstance = typeof defaultPrisma;

type MobileMaterialCondition = "BARU" | "BEKAS" | "RUSAK";

export type MobileWorkOrderMaterialInput = {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: MobileMaterialCondition;
};

export type MobileWorkOrderMaterialResult = {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: MobileMaterialCondition;
  barangId: string;
  gudangId: string;
};

export type MobileWorkOrderMaterialTarget = {
  id: string;
  tenantId: string;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
};

export class WorkOrderMaterialRepository {
  constructor(private prisma: PrismaInstance = defaultPrisma) {}

  async addMaterialWithStockDeduction(
    workOrderId: string,
    barangId: string,
    quantity: number,
    actorId: string,
    notes?: string | null,
    preferredGudangId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrders.findUnique({
        where: { id: workOrderId },
      });
      if (!workOrder) {
        throw new Error("Work order tidak ditemukan");
      }

      const barang = await tx.barang.findUnique({
        where: { id: barangId },
        include: {
          barangGudang: {
            where: {
              stok: { gte: quantity },
              ...(preferredGudangId ? { gudangId: preferredGudangId } : {}),
            },
            orderBy: { stok: "desc" },
            take: 1,
          },
        },
      });

      if (!barang) {
        throw new Error("Barang tidak ditemukan");
      }

      const gudangSource = barang.barangGudang[0];
      if (!gudangSource || gudangSource.stok < quantity) {
        throw new Error(
          `Stok tidak mencukupi di gudang yang ditentukan. Tersedia: ${gudangSource?.stok || 0}`,
        );
      }

      if (Math.floor(quantity) !== quantity) {
        throw new Error(
          "Jumlah material harus angka bulat (tidak boleh desimal)",
        );
      }

      await tx.barangGudang.update({
        where: {
          barangId_gudangId: {
            barangId,
            gudangId: gudangSource.gudangId,
          },
        },
        data: {
          stok: { decrement: quantity },
          stokBaru: { decrement: quantity },
        },
      });

      const material = await tx.workOrderMaterial.create({
        data: {
          workOrderId,
          barangId,
          quantity,
          notes: notes ?? null,
          satuan: barang.satuan,
        },
        include: {
          barang: true,
        },
      });

      await tx.barangKeluar.create({
        data: {
          id: randomUUID(),
          barangId,
          gudangId: gudangSource.gudangId,
          jumlah: quantity,
          tanggal: new Date(),
          kondisi: "BARU",
          keterangan: `Used in Work Order #${workOrder.workOrderNumber}`,
          tujuanPenggunaan: "WORK_ORDER",
          userId: actorId,
        },
      });

      return material;
    });
  }

  async addMobileMaterialsWithStockDeduction(params: {
    workOrder: MobileWorkOrderMaterialTarget;
    items: MobileWorkOrderMaterialInput[];
    actorId: string;
  }): Promise<MobileWorkOrderMaterialResult[]> {
    const { workOrder, items, actorId } = params;

    return this.prisma.$transaction(async (tx) => {
      const createdItems: MobileWorkOrderMaterialResult[] = [];

      for (const item of items) {
        createdItems.push(
          await createMobileMaterialUsage({ tx, workOrder, item, actorId }),
        );
      }

      await appendUsedMaterialsToWorkOrder(tx, workOrder.id, createdItems);
      await assertWorkOrderStillExists(tx, workOrder.id);

      await tx.workOrderUpdates.create({
        data: {
          id: randomUUID(),
          workOrderId: workOrder.id,
          createdById: actorId,
          updateType: "MATERIAL_PICKUP",
          message: `Mengambil barang: ${createMaterialPickupMessage(createdItems)}`,
          oldStatus: workOrder.status,
          newStatus: workOrder.status,
        },
      });

      return createdItems;
    });
  }
}

async function assertWorkOrderStillExists(
  tx: Parameters<Parameters<PrismaInstance["$transaction"]>[0]>[0],
  workOrderId: string,
) {
  const updatedWorkOrder = await tx.workOrders.findUnique({
    where: { id: workOrderId },
    select: { usedMaterials: true },
  });

  if (!updatedWorkOrder) throw new Error("Work order tidak ditemukan");
}
