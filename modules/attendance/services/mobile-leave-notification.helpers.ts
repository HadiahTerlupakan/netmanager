import { logger } from "@/lib/logger";
import {
  createNotification,
  WhatsAppApprovalButtonService,
} from "@/modules/notification";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";

const LEAVE_APPROVAL_LINK = "/admin/kehadiran/izin";
const LEAVE_APPROVAL_TITLE = "Pengajuan Izin Baru (Mobile)";

type MobileLeaveApprover = Awaited<
  ReturnType<ILeaveRepository["findApproverIdsForMobileLeaveNotification"]>
>[number];

interface MobileLeaveNotificationInput {
  tenantId: string;
  requestId: string;
  siteId?: string | null;
  requesterName?: string | null;
  leaveType: string;
  reason: string;
}

export class MobileLeaveNotificationHelper {
  constructor(
    private readonly leaveRepository: ILeaveRepository,
    private readonly whatsAppService = new WhatsAppApprovalButtonService(),
  ) {}

  /** Kirim notifikasi pengajuan izin mobile ke approver. */
  async notifyApprovers(input: MobileLeaveNotificationInput): Promise<void> {
    try {
      const approvers =
        await this.leaveRepository.findApproverIdsForMobileLeaveNotification({
          tenantId: input.tenantId,
          siteId: input.siteId,
        });
      await Promise.all(
        approvers.map((approver) => this.notifyApprover(approver, input)),
      );
    } catch (error) {
      logger.error(
        "Failed to notify admins",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async notifyApprover(
    approver: MobileLeaveApprover,
    input: MobileLeaveNotificationInput,
  ): Promise<void> {
    const message = `${input.requesterName} mengajukan ${input.leaveType}: ${input.reason}`;
    await createNotification({
      type: "SYSTEM",
      priority: "NORMAL",
      title: LEAVE_APPROVAL_TITLE,
      message,
      link: LEAVE_APPROVAL_LINK,
      userId: approver.id,
      sourceType: "LEAVE",
      sourceId: input.requestId,
      tenantId: input.tenantId,
    });
    await this.whatsAppService.sendApprovalButton({
      phone: approver.phone,
      title: LEAVE_APPROVAL_TITLE,
      message,
      approvalUrl: LEAVE_APPROVAL_LINK,
    });
  }
}
