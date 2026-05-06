import { logger } from "@/lib/logger";
import { WhatsAppSenderService } from "./whatsapp-sender.service";

const APPROVAL_FOOTER = "NetManager Approval";
const APPROVAL_BUTTON_TEXT = "Buka Approval";

export interface ApprovalButtonNotificationInput {
  phone?: string | null;
  title: string;
  message: string;
  approvalUrl: string;
  tenantId?: string;
}

export class WhatsAppApprovalButtonService {
  constructor(
    private readonly whatsAppSenderService = new WhatsAppSenderService(),
  ) {}

  /** Mengirim pesan WhatsApp untuk approval admin menggunakan account INTERNAL. */
  async sendApprovalButton(
    input: ApprovalButtonNotificationInput,
  ): Promise<{ success: boolean; error?: string }> {
    const phone = input.phone?.trim();
    if (!phone) {
      return { success: false, error: "Phone number is required" };
    }

    const message = this.buildMessage(input);
    const result = await this.whatsAppSenderService.send({
      phone,
      message,
      accountType: "INTERNAL", // Use INTERNAL account type
      tenantId: input.tenantId,
    });

    if (!result.success) {
      logger.error("[WhatsApp Approval] Failed to send message", result.error);
    }

    return result;
  }

  private buildMessage(input: ApprovalButtonNotificationInput) {
    return `*${input.title}*\n\n${input.message}\n\n${APPROVAL_FOOTER}\n${APPROVAL_BUTTON_TEXT}: ${input.approvalUrl}`;
  }
}
