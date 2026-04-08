import { randomUUID } from "crypto";
import { Prisma, type WorkOrderStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

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
        const { barangId, gudangId, jumlah } = item;
        const kondisi = item.kondisi || "BARU";
        const jumlahInt = Math.floor(jumlah);

        if (jumlahInt <= 0) {
          throw new Error("Jumlah harus angka bulat positif");
        }

        if (jumlahInt !== jumlah) {
          throw new Error(
            "Jumlah material harus angka bulat (tidak boleh desimal)",
          );
        }

        const barangGudang = await tx.barangGudang.findFirst({
          where: {
            barangId,
            gudangId,
            tenantId: workOrder.tenantId,
          },
          include: { barang: true },
        });

        if (!barangGudang) {
          throw new Error("Data stok tidak ditemukan di gudang ini");
        }

        const stockField =
          kondisi === "BARU"
            ? "stokBaru"
            : kondisi === "BEKAS"
              ? "stokBekas"
              : kondisi === "RUSAK"
                ? "stokRusak"
                : "stok";
        const availableStock = barangGudang[stockField];

        if (availableStock < jumlahInt) {
          throw new Error(
            `Stok ${kondisi} tidak mencukupi untuk barang ${barangGudang.barang.nama}. Tersedia: ${availableStock}`,
          );
        }

        const updateData: Prisma.BarangGudangUpdateInput = {
          stok: { decrement: jumlahInt },
        };

        if (kondisi === "BARU") updateData.stokBaru = { decrement: jumlahInt };
        else if (kondisi === "BEKAS")
          updateData.stokBekas = { decrement: jumlahInt };
        else if (kondisi === "RUSAK")
          updateData.stokRusak = { decrement: jumlahInt };

        const updatedStock = await tx.barangGudang.updateMany({
          where: {
            id: barangGudang.id,
            [stockField]: { gte: jumlahInt },
          },
          data: updateData,
        });

        if (updatedStock.count === 0) {
          throw new Error(
            `Stok ${kondisi} tidak mencukupi untuk barang ${barangGudang.barang.nama}. Tersedia: ${availableStock}`,
          );
        }

        const keluar = await tx.barangKeluar.create({
          data: {
            id: randomUUID(),
            barangId,
            gudangId,
            jumlah: jumlahInt,
            kondisi,
            userId: actorId,
            purpose: `Work Order: ${workOrder.workOrderNumber}`,
            keterangan: `Digunakan untuk work order ${workOrder.workOrderNumber} - ${workOrder.title}`,
            tenantId: workOrder.tenantId,
          },
          include: { barang: true },
        });

        createdItems.push({
          id: keluar.id,
          nama: keluar.barang.nama,
          jumlah: jumlahInt,
          satuan: keluar.barang.satuan,
          kondisi,
          barangId,
          gudangId,
        });
      }

      await tx.$executeRaw`
                UPDATE "WorkOrders"
                SET "usedMaterials" = COALESCE("usedMaterials", '[]'::jsonb) || ${JSON.stringify(createdItems)}::jsonb,
                    "updatedAt" = NOW()
                WHERE "id" = ${workOrder.id}
            `;
      const updatedWorkOrder = await tx.workOrders.findUnique({
        where: { id: workOrder.id },
        select: { usedMaterials: true },
      });
      if (!updatedWorkOrder) {
        throw new Error("Work order tidak ditemukan");
      }

      const materialList = createdItems
        .map((m) => `${m.nama} - ${m.kondisi} (${m.jumlah} ${m.satuan})`)
        .join(", ");
      await tx.workOrderUpdates.create({
        data: {
          id: randomUUID(),
          workOrderId: workOrder.id,
          createdById: actorId,
          updateType: "MATERIAL_PICKUP",
          message: `Mengambil barang: ${materialList}`,
          oldStatus: workOrder.status,
          newStatus: workOrder.status,
        },
      });

      return createdItems;
    });
  }
}
