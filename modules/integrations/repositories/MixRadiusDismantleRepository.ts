import { randomUUID } from "crypto";
import { prisma } from "@/modules/database";

export const DISMANTLE_TASKS = [
  "Konfirmasi jadwal kedatangan dengan pelanggan",
  "Pastikan perangkat (Modem/Router) dalam keadaan lengkap (Unit + Adaptor)",
  "Cek kondisi fisik perangkat (Baik/Rusak/Terbakar)",
  "Foto dokumentasi penarikan perangkat",
  "Foto dokumentasi lokasi/rumah pelanggan",
  "Update status inventory barang masuk",
  "Konfirmasi ke Admin untuk update data pelanggan",
] as const;

export class MixRadiusDismantleRepository {
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
    await prisma.workOrderTasks.createMany({
      data: DISMANTLE_TASKS.map((title, index) => ({
        id: randomUUID(),
        workOrderId,
        title,
        order: index,
        status: "PENDING",
        updatedAt: new Date(),
      })),
    });
  }
}
