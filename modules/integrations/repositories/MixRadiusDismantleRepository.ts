import { randomUUID } from "crypto";
import { prisma } from "@/modules/database";
import type { IMixRadiusDismantleRepository } from "../domain/ports/IMixRadiusDismantleRepository";

export const DISMANTLE_TASKS = [
  "Konfirmasi jadwal kedatangan dengan pelanggan",
  "Pastikan perangkat (Modem/Router) dalam keadaan lengkap (Unit + Adaptor)",
  "Cek kondisi fisik perangkat (Baik/Rusak/Terbakar)",
  "Foto dokumentasi penarikan perangkat",
  "Foto dokumentasi lokasi/rumah pelanggan",
  "Update status inventory barang masuk",
  "Konfirmasi ke Admin untuk update data pelanggan",
] as const;

export class MixRadiusDismantleRepository implements IMixRadiusDismantleRepository {
  /** Find local context needed to create dismantle work order. */
  async findRequestContext(input: {
    userId: string;
    memberId: string;
    username: string;
    departmentKeyword: string;
  }) {
    const [requester, localPelanggan, department] = await Promise.all([
      prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, siteId: true },
      }),
      prisma.pelanggan.findFirst({
        where: {
          OR: [{ idPelanggan: input.memberId }, { username: input.username }],
        },
        select: { id: true, siteId: true },
      }),
      prisma.departments.findFirst({
        where: {
          name: { contains: input.departmentKeyword, mode: "insensitive" },
        },
        select: { id: true },
      }),
    ]);

    return { requester, localPelanggan, department };
  }

  /** Create default dismantle tasks for work order. */
  async createDefaultTasks(workOrderId: string) {
    const wo = await prisma.workOrders.findUnique({
      where: { id: workOrderId },
      select: { tenantId: true },
    });
    if (!wo) throw new Error("Work order not found");
    await prisma.workOrderTasks.createMany({
      data: DISMANTLE_TASKS.map((title, index) => ({
        id: randomUUID(),
        workOrderId,
        title,
        order: index,
        status: "PENDING" as const,
        updatedAt: new Date(),
        tenantId: wo.tenantId,
      })),
    });
  }
}
