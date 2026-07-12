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
      const authToken = this.config.apiKey?.trim();
      if (!authToken) {
        return {
          success: false,
          error: "API key / token Wablas belum dikonfigurasi",
        };
      }

      if (!authToken.includes(".")) {
        return {
          success: false,
          error:
            "Format API Key Wablas salah. Isi dengan token.secret_key (keduanya dari Device → Settings di dashboard Wablas). Contoh: abcd1234.xyzsecret. Saat edit akun, field API Key harus diisi ulang — biarkan kosong = token lama tetap dipakai.",
        };
      }

      const url = this.buildUrl(path);
      const response = await whatsAppThrottler.add(() =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: authToken,
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

      const rawError = resolveGatewayErrorMessage(result, fallbackError);
      return {
        success: false,
        error: this.clarifyWablasError(rawError, response.status),
        response: result,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kesalahan jaringan",
      };
    }
  }

  private clarifyWablasError(rawError: string, status: number): string {
    const lower = rawError.toLowerCase();
    if (
      status === 403 ||
      lower.includes("not authorized") ||
      lower.includes("secret key") ||
      lower.includes("need secret")
    ) {
      return (
        "Wablas menolak: butuh secret_key atau IP server di-whitelist. " +
        "Edit akun → isi ulang API Key dengan format token.secret_key " +
        "(secret_key digenerate di Device → Settings Wablas, dikirim ke WhatsApp admin). " +
        "Detail: " +
        rawError
      );
    }
    return rawError;
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
