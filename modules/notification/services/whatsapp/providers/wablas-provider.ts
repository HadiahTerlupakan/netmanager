import {
  isSuccessGatewayResponse,
  normalizeWhatsAppPhone,
  parseGatewayResponse,
  resolveGatewayErrorMessage,
} from "../whatsapp-gateway-utils";
import { whatsAppThrottler } from "../whatsapp-throttler";
import type {
  SendFileParams,
  SendMessageParams,
  SendResult,
  WhatsAppConfig,
  WhatsAppProvider,
} from "../whatsapp-provider-interface";

const DEFAULT_DOCUMENT_FILENAME = "document.pdf";

export class WablasProvider implements WhatsAppProvider {
  name = "Wablas";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const form = new FormData();
    form.append("number", normalizeWhatsAppPhone(params.phone));
    form.append("message", params.message);
    this.appendSender(form);

    return this.sendRequest("send-message", form, "Gagal mengirim pesan");
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    const form = new FormData();
    form.append("number", normalizeWhatsAppPhone(params.phone));
    form.append("document", params.fileUrl);
    form.append("caption", params.caption || "");
    form.append("filename", params.filename || DEFAULT_DOCUMENT_FILENAME);
    this.appendSender(form);

    return this.sendRequest("send-document", form, "Gagal mengirim file");
  }

  private async sendRequest(
    path: string,
    form: FormData,
    fallbackError: string,
  ): Promise<SendResult> {
    try {
      const url = this.buildUrl(path);
      const response = await whatsAppThrottler.add(() =>
        fetch(url, { method: "POST", body: form }),
      );
      const result = await parseGatewayResponse(response, url);

      if (response.ok && isSuccessGatewayResponse(result)) {
        return {
          success: true,
          messageId: this.getMessageId(result),
          response: result,
        };
      }

      return {
        success: false,
        error: resolveGatewayErrorMessage(result, fallbackError),
        response: result,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kesalahan jaringan",
      };
    }
  }

  private buildUrl(path: string): string {
    if (!this.config.domain) {
      throw new Error("Domain Wablas belum dikonfigurasi");
    }

    const baseUrl = this.config.domain.startsWith("http")
      ? this.config.domain
      : `https://${this.config.domain}`;
    const base = baseUrl.replace(/\/$/, "");
    // Wablas hanya membaca token via query param ?token=, bukan Authorization
    // header maupun field form `api_key`.
    return `${base}/api/${path}?token=${encodeURIComponent(this.config.apiKey)}`;
  }

  private appendSender(form: FormData): void {
    if (this.config.deviceId) {
      form.append("sender", this.config.deviceId);
    }
  }

  private getMessageId(result: Record<string, unknown>): string | undefined {
    const data = result.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const dataRecord = Object.fromEntries(Object.entries(data));
      const messages = dataRecord.messages;
      if (Array.isArray(messages)) {
        const firstMessage = messages[0];
        if (firstMessage && typeof firstMessage === "object") {
          const messageRecord = Object.fromEntries(
            Object.entries(firstMessage),
          );
          if (typeof messageRecord.id === "string") {
            return messageRecord.id;
          }
        }
      }
      if (typeof dataRecord.id === "string") {
        return dataRecord.id;
      }
    }

    return typeof result.id === "string" ? result.id : undefined;
  }
}
