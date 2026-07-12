import { normalizeWhatsAppPhone } from "../whatsapp-gateway-utils";
import {
  sendBaileysMessage,
  sendBaileysFile,
} from "../baileys-session-manager";
import type {
  SendFileParams,
  SendMessageParams,
  SendResult,
  WhatsAppConfig,
  WhatsAppProvider,
} from "../whatsapp-provider-interface";

export class BaileysProvider implements WhatsAppProvider {
  name = "Baileys (Self-hosted)";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    return sendBaileysMessage(
      this.sessionId(),
      normalizeWhatsAppPhone(params.phone),
      params.message,
    );
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    return sendBaileysFile(
      this.sessionId(),
      normalizeWhatsAppPhone(params.phone),
      params.fileUrl,
      params.caption || "",
    );
  }

  private sessionId(): string {
    return this.config.accountId || this.config.deviceId || "default";
  }
}
