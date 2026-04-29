import type {
  SendButtonParams,
  SendFileParams,
  SendMessageParams,
  SendResult,
  WhatsAppConfig,
  WhatsAppProvider,
} from "../whatsapp-provider-interface";
import { whatsAppThrottler } from "../whatsapp-throttler";

const DEFAULT_DOCUMENT_FILENAME = "document.pdf";
const SEND_BUTTON_PATH = "send-button";
const SEND_MESSAGE_PATH = "send-message";
const SEND_MEDIA_PATH = "send-media";
const RESPONSE_PREVIEW_MAX_LENGTH = 240;

export class MpwaProvider implements WhatsAppProvider {
  name = "MPWA Gateway";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    return this.sendRequest(SEND_MESSAGE_PATH, {
      api_key: this.config.apiKey,
      sender: this.getSender(),
      number: params.phone,
      message: params.message,
    });
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    return this.sendRequest(SEND_MEDIA_PATH, {
      api_key: this.config.apiKey,
      sender: this.getSender(),
      number: params.phone,
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
      number: params.phone,
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
    const result = await this.parseResponse(response, url);

    if (response.ok && this.isSuccessResponse(result)) {
      return {
        success: true,
        messageId: result.id || result.messageId || result.data?.id,
      };
    }

    return { success: false, error: this.resolveErrorMessage(result) };
  }

  private async parseResponse(response: Response, url: string) {
    const contentType = response.headers.get("content-type") || "";
    const responseText = await response.text();

    if (contentType.includes("application/json")) {
      return {
        ...JSON.parse(responseText || "{}"),
        statusCode: response.status,
        requestUrl: url,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      requestUrl: url,
      error: `Gateway mengembalikan ${contentType || "response non-JSON"} dari ${url} dengan status ${response.status}: ${this.previewResponse(responseText)}`,
    };
  }

  private resolveErrorMessage(result: Record<string, unknown>) {
    const providerMessage = result.message || result.error || result.reason;
    const statusCode = result.statusCode ? `status ${result.statusCode}` : null;
    const requestUrl = result.requestUrl ? `URL ${result.requestUrl}` : null;
    const detail = [statusCode, requestUrl].filter(Boolean).join(", ");

    if (providerMessage) {
      return detail
        ? `${String(providerMessage)} (${detail})`
        : String(providerMessage);
    }

    return detail ? `Gagal mengirim pesan (${detail})` : "Gagal mengirim pesan";
  }

  private previewResponse(responseText: string) {
    return responseText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, RESPONSE_PREVIEW_MAX_LENGTH);
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
