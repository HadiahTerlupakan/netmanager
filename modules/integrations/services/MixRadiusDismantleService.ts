import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

import { prisma } from "@/modules/database";
import { onWorkOrderCreated } from "@/modules/work-order";
import { WorkOrderRepository } from "@/modules/work-order/repositories/WorkOrderRepository";

import { MixRadiusConfigError, MixRadiusService } from "./MixRadiusService";
import { createRouteServiceError } from "@/modules/finance";

const TECHNICAL_DEPARTMENT_KEYWORD = "Teknis";
const DISMANTLE_TASKS = [
  "Konfirmasi jadwal kedatangan dengan pelanggan",
  "Pastikan perangkat (Modem/Router) dalam keadaan lengkap (Unit + Adaptor)",
  "Cek kondisi fisik perangkat (Baik/Rusak/Terbakar)",
  "Foto dokumentasi penarikan perangkat",
  "Foto dokumentasi lokasi/rumah pelanggan",
  "Update status inventory barang masuk",
  "Konfirmasi ke Admin untuk update data pelanggan",
] as const;

export class MixRadiusDismantleService {
  constructor(
    private readonly mixRadiusService = new MixRadiusService(),
    private readonly workOrderRepository = new WorkOrderRepository(),
  ) {}

  /** Create dismantle work order from MixRadius customer data. */
  async createDismantleRequest(input: {
    userId: string;
    customerId: string;
    reason: string;
    notes?: string;
  }) {
    const customer = await this.findCustomer(input.customerId);
    const [requester, localPelanggan, department] = await Promise.all([
      prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, siteId: true },
      }),
      prisma.pelanggan.findFirst({
        where: {
          OR: [
            { idPelanggan: customer.member_id },
            { username: customer.username },
          ],
        },
        select: { id: true, siteId: true },
      }),
      prisma.departments.findFirst({
        where: {
          name: {
            contains: TECHNICAL_DEPARTMENT_KEYWORD,
            mode: "insensitive",
          },
        },
        select: { id: true },
      }),
    ]);
    const targetSiteId =
      requester?.siteId || localPelanggan?.siteId || undefined;
    const workOrder = await this.workOrderRepository.create({
      type: "DISCONNECTION",
      title: `Request Dismantle: ${customer.fullname} (${customer.username})`,
      description: this.buildDescription(customer, input.reason, input.notes),
      priority: "NORMAL",
      contactName: customer.fullname,
      contactPhone: customer.phonenumber,
      locationAddress: customer.address,
      disconnectionReason: input.reason,
      createdById: input.userId,
      ...(localPelanggan?.id ? { pelangganId: localPelanggan.id } : {}),
      ...(targetSiteId ? { siteId: targetSiteId } : {}),
      ...(department?.id ? { departmentId: department.id } : {}),
      ...(input.notes ? { internalNotes: input.notes } : {}),
    });

    await this.createDefaultTasks(workOrder.id);
    await this.dispatchWorkOrderCreated(workOrder, input.userId);
    return workOrder;
  }

  private async findCustomer(customerId: string) {
    try {
      const customer =
        await this.mixRadiusService.fetchCustomerDetail(customerId);

      if (!customer) {
        throw createRouteServiceError(
          "Pelanggan tidak ditemukan di MixRadius",
          404,
        );
      }

      return customer;
    } catch (error) {
      if (error instanceof MixRadiusConfigError) {
        throw error;
      }

      throw error;
    }
  }

  private buildDescription(
    customer: {
      member_id: string;
      plan_name: string;
      address: string;
    },
    reason: string,
    notes?: string,
  ) {
    return (
      "Permintaan pembongkaran perangkat (dismantle) untuk pelanggan MixRadius.\n\n" +
      `Alasan: ${reason}\n` +
      `Catatan: ${notes || "-"}\n\n` +
      "Data MixRadius:\n" +
      `- Member ID: ${customer.member_id}\n` +
      `- Paket: ${customer.plan_name}\n` +
      `- Alamat (Portal): ${customer.address}`
    );
  }

  private async createDefaultTasks(workOrderId: string) {
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

  private async dispatchWorkOrderCreated(
    workOrder: {
      id: string;
      workOrderNumber: string;
      title: string;
      type: string;
      priority: string;
      departmentId: string | null;
      siteId: string | null;
      status: string;
      createdAt: Date;
    },
    userId: string,
  ) {
    await onWorkOrderCreated(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
      },
      userId,
    ).catch((error) => {
      logger.error("[Dismantle] Notification error:", error);
    });

    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.newWorkOrder(
        {
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          type: workOrder.type,
          status: workOrder.status,
          priority: workOrder.priority,
          createdAt: workOrder.createdAt.toISOString(),
          ...(workOrder.departmentId
            ? { departmentId: workOrder.departmentId }
            : {}),
        },
        workOrder.departmentId || undefined,
      );
    } catch (error) {
      logger.error("[Dismantle] Socket broadcast failed", error);
    }
  }
}
