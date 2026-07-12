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
    const body = new URLSearchParams();
    body.append("phone", normalizeWhatsAppPhone(params.phone));
    body.append("message", params.message);
    this.appendSender(body);

    return this.sendRequest("send-message", body, "Gagal mengirim pesan");
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    const body = new URLSearchParams();
    body.append("phone", normalizeWhatsAppPhone(params.phone));
    body.append("document", params.fileUrl);
    body.append("caption", params.caption || "");
    body.append("filename", params.filename || DEFAULT_DOCUMENT_FILENAME);
    this.appendSender(body);

    return this.sendRequest("send-document", body, "Gagal mengirim file");
  }

  private async sendRequest(
    path: string,
    body: URLSearchParams,
    fallbackError: string,
  ): Promise<SendResult> {
    try {
      if (!this.config.apiKey?.trim()) {
        return {
          success: false,
          error: "API key / token Wablas belum dikonfigurasi",
        };
      }

      const url = this.buildUrl(path);
      const response = await whatsAppThrottler.add(() =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: this.config.apiKey,
          },
          body,
        }),
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
    return `${base}/api/${path}`;
  }

  private appendSender(body: URLSearchParams): void {
    if (this.config.deviceId) {
      body.append("sender", this.config.deviceId);
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
