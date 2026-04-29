import { logger } from "@/lib/logger";

import { WhatsAppService } from "./whatsapp/whatsapp-service";
import type { WhatsAppButtonItem } from "./whatsapp/whatsapp-provider-interface";

const APPROVAL_FOOTER = "NetManager Approval";
const APPROVAL_BUTTON_TEXT = "Buka Approval";

export interface ApprovalButtonNotificationInput {
  phone?: string | null;
  title: string;
  message: string;
  approvalUrl: string;
}

export class WhatsAppApprovalButtonService {
  constructor(private readonly whatsAppService = new WhatsAppService()) {}

  /** Mengirim pesan WhatsApp button untuk membuka halaman approval admin. */
  async sendApprovalButton(input: ApprovalButtonNotificationInput) {
    const phone = input.phone?.trim();
    if (!phone) return;

    const result = await this.whatsAppService.sendButton({
      phone,
      message: this.buildMessage(input),
      footer: APPROVAL_FOOTER,
      buttons: [this.buildApprovalButton(input.approvalUrl)],
    });

    if (!result.success) {
      logger.error("[WhatsApp Approval] Failed to send button", result.error);
    }
  }

  private buildMessage(input: ApprovalButtonNotificationInput) {
    return `*${input.title}*\n\n${input.message}`;
  }

  private buildApprovalButton(approvalUrl: string): WhatsAppButtonItem {
    return {
      type: "url",
      displayText: APPROVAL_BUTTON_TEXT,
      url: approvalUrl,
    };
  }
}
