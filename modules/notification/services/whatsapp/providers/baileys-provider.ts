import { normalizeWhatsAppPhone } from "../whatsapp-gateway-utils";
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
    const { sendBaileysMessage } = await import("../baileys-session-manager");
    return sendBaileysMessage(
      this.sessionId(),
      normalizeWhatsAppPhone(params.phone),
      params.message,
    );
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    const { sendBaileysFile } = await import("../baileys-session-manager");
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
