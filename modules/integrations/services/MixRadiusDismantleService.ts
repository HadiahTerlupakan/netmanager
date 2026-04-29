import { WorkOrderQueryService } from "@/modules/work-order";
import { createRouteServiceError } from "@/modules/finance";
import { MixRadiusDismantleRepository } from "../repositories/MixRadiusDismantleRepository";
import { MixRadiusConfigError, MixRadiusService } from "./MixRadiusService";
import { MixRadiusDismantleNotificationService } from "./MixRadiusDismantleNotificationService";

const TECHNICAL_DEPARTMENT_KEYWORD = "Teknis";

export class MixRadiusDismantleService {
  constructor(
    private readonly mixRadiusService = new MixRadiusService(),
    private readonly workOrderRepository = new WorkOrderQueryService(),
    private readonly repository = new MixRadiusDismantleRepository(),
    private readonly notificationService = new MixRadiusDismantleNotificationService(),
  ) {}

  /** Create dismantle work order from MixRadius customer data. */
  async createDismantleRequest(input: {
    userId: string;
    customerId: string;
    reason: string;
    notes?: string;
  }) {
    const customer = await this.findCustomer(input.customerId);
    const context = await this.repository.findRequestContext({
      userId: input.userId,
      memberId: customer.member_id,
      username: customer.username,
      departmentKeyword: TECHNICAL_DEPARTMENT_KEYWORD,
    });
    const targetSiteId =
      context.requester?.siteId || context.localPelanggan?.siteId || undefined;
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
      ...(context.localPelanggan?.id
        ? { pelangganId: context.localPelanggan.id }
        : {}),
      ...(targetSiteId ? { siteId: targetSiteId } : {}),
      ...(context.department?.id
        ? { departmentId: context.department.id }
        : {}),
      ...(input.notes ? { internalNotes: input.notes } : {}),
    });

    await this.repository.createDefaultTasks(workOrder.id);
    await this.notificationService.dispatchWorkOrderCreated(
      workOrder,
      input.userId,
    );
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
      if (error instanceof MixRadiusConfigError) throw error;
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
}
