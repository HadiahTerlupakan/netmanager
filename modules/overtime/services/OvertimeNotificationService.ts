import { logger } from "@/lib/logger";
import {
  createNotification,
  WhatsAppApprovalButtonService,
} from "@/modules/notification";
import { UserLookupService } from "@/modules/users";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";

const OVERTIME_APPROVAL_LINK = "/admin/lembur";
const OVERTIME_APPROVAL_TITLE = "Pengajuan Lembur Baru";

/** Mengirim notifikasi terkait approval dan status overtime. */
export class OvertimeNotificationService {
  constructor(
    private readonly userLookupService = new UserLookupService(),
    private readonly whatsAppApprovalButtonService = new WhatsAppApprovalButtonService(),
  ) {}

  /** Beri tahu admin saat ada pengajuan lembur baru. */
  async notifyAdminsForNewRequest(input: NewOvertimeNotificationInput) {
    try {
      const user = await this.userLookupService.findByIdWithSite(
        input.userId,
        input.tenantId,
      );
      const admins = await this.userLookupService.findAdminsForNotification(
        input.tenantId,
        user?.siteId ?? null,
      );

      for (const admin of admins) {
        await this.notifyAdmin(admin, user?.name, input);
      }
    } catch (error) {
      logger.error("Failed to send notification:", error);
    }
  }

  /** Beri tahu karyawan bahwa pengajuan lembur disetujui. */
  async notifyUserApproved(overtime: OvertimeEntity) {
    await this.notifyUserStatus({
      overtime,
      title: "Pengajuan Lembur Disetujui",
      message:
        "Pengajuan lembur Anda telah disetujui. Silakan mulai lembur setelah checkout.",
    });
  }

  /** Beri tahu karyawan bahwa pengajuan lembur ditolak. */
  async notifyUserRejected(overtime: OvertimeEntity, reason: string) {
    await this.notifyUserStatus({
      overtime,
      title: "Pengajuan Lembur Ditolak",
      message: `Alasan: ${reason}`,
    });
  }

  private async notifyAdmin(
    admin: { id: string; phone?: string | null },
    userName: string | null | undefined,
    input: NewOvertimeNotificationInput,
  ) {
    const message = `${userName || "Karyawan"} mengajukan lembur: ${input.reason}`;
    await createNotification({
      type: "SYSTEM",
      priority: "NORMAL",
      title: OVERTIME_APPROVAL_TITLE,
      message,
      link: OVERTIME_APPROVAL_LINK,
      userId: admin.id,
      sourceType: "OVERTIME",
      sourceId: input.request.id,
      tenantId: input.tenantId,
    });
    await this.whatsAppApprovalButtonService.sendApprovalButton({
      phone: admin.phone,
      title: OVERTIME_APPROVAL_TITLE,
      message,
      approvalUrl: OVERTIME_APPROVAL_LINK,
      tenantId: input.tenantId,
    });
  }

  private async notifyUserStatus(input: UserStatusNotificationInput) {
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: input.title,
        message: input.message,
        link: "/karyawan/lembur",
        userId: input.overtime.userId,
        sourceType: "OVERTIME",
        sourceId: input.overtime.id,
        tenantId: input.overtime.tenantId || undefined,
      });
    } catch (error) {
      logger.error("Failed to send notification:", error);
    }
  }
}

type NewOvertimeNotificationInput = {
  userId: string;
  reason: string;
  request: OvertimeEntity;
  tenantId?: string;
};

type UserStatusNotificationInput = {
  overtime: OvertimeEntity;
  title: string;
  message: string;
};
