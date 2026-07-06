import {
  isSuccessGatewayResponse,
  normalizeWhatsAppPhone,
  parseGatewayResponse,
  resolveGatewayErrorMessage,
} from "../whatsapp-gateway-utils";
import { whatsAppThrottler } from "../whatsapp-throttler";
import type {
  SendButtonParams,
  SendFileParams,
  SendMessageParams,
  SendResult,
  WhatsAppConfig,
  WhatsAppProvider,
} from "../whatsapp-provider-interface";

const DEFAULT_DOCUMENT_FILENAME = "document.pdf";
const SEND_BUTTON_PATH = "send-button";
const SEND_MESSAGE_PATH = "send-message";
const SEND_MEDIA_PATH = "send-media";

export class MpwaProvider implements WhatsAppProvider {
  name = "MPWA Gateway";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    return this.sendRequest(SEND_MESSAGE_PATH, {
      api_key: this.config.apiKey,
      sender: this.getSender(),
      number: normalizeWhatsAppPhone(params.phone),
      message: params.message,
    });
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    return this.sendRequest(SEND_MEDIA_PATH, {
      api_key: this.config.apiKey,
      sender: this.getSender(),
      number: normalizeWhatsAppPhone(params.phone),
      url: params.fileUrl,
      media: params.fileUrl,
      caption: params.caption || "",
      filename: params.filename || DEFAULT_DOCUMENT_FILENAME,
    });
  }

  async sendButton(params: SendButtonParams): Promise<SendResult> {
    return this.sendRequest(SEND_BUTTON_PATH, {
      api_key: this.config.apiKey,
      sender: this.getSender(),
      number: normalizeWhatsAppPhone(params.phone),
      message: params.message,
      button: params.buttons,
      footer: params.footer || "",
      url: params.mediaUrl || "",
    });
  }

  private async sendRequest(
    path: string,
    payload: Record<string, string | object>,
  ) {
    try {
      return this.postToGateway(this.buildUrl(path), payload);
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kesalahan jaringan",
      };
    }
  }

  private async postToGateway(
    url: string,
    payload: Record<string, string | object>,
  ): Promise<SendResult> {
    const response = await whatsAppThrottler.add(() =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      error: resolveGatewayErrorMessage(result, "Gagal mengirim pesan"),
      response: result,
    };
  }

  private getMessageId(result: Record<string, unknown>): string | undefined {
    const id = result.id || result.messageId;
    if (typeof id === "string") {
      return id;
    }

    const data = result.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const dataRecord = Object.fromEntries(Object.entries(data));
      return typeof dataRecord.id === "string" ? dataRecord.id : undefined;
    }

    return undefined;
  }

  private buildUrl(path: string) {
    const baseUrl = this.getBaseUrl().replace(/\/$/, "");
    if (/\/(send|message|messages|media)(\/|$)/.test(baseUrl)) {
      return baseUrl;
    }

    return `${baseUrl}/${path}`;
  }

  private getBaseUrl() {
    if (!this.config.domain) {
      throw new Error("Domain MPWA Gateway belum dikonfigurasi");
    }

    return this.config.domain.startsWith("http")
      ? this.config.domain
      : `https://${this.config.domain}`;
  }

  private getSender() {
    if (!this.config.deviceId) {
      throw new Error("Sender MPWA Gateway belum dikonfigurasi");
    }

    return this.config.deviceId;
  }

  private isSuccessResponse(result: Record<string, unknown>) {
    return (
      result.status === true ||
      result.success === true ||
      result.status === "success" ||
      result.status === "sent" ||
      result.message === "success"
    );
  }
}
