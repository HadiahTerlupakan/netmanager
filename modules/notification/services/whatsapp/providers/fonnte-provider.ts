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

const FONNTE_SEND_URL = "https://api.fonnte.com/send";
const DEFAULT_DOCUMENT_FILENAME = "document.pdf";

export class FonnteProvider implements WhatsAppProvider {
  name = "Fonnte";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    return this.sendRequest(
      {
        target: normalizeWhatsAppPhone(params.phone),
        message: params.message,
        countryCode: "62",
      },
      "Gagal mengirim pesan",
    );
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    return this.sendRequest(
      {
        target: normalizeWhatsAppPhone(params.phone),
        file: params.fileUrl,
        caption: params.caption || "",
        filename: params.filename || DEFAULT_DOCUMENT_FILENAME,
        countryCode: "62",
      },
      "Gagal mengirim file",
    );
  }

  private async sendRequest(
    payload: Record<string, string>,
    fallbackError: string,
  ): Promise<SendResult> {
    try {
      const response = await whatsAppThrottler.add(() =>
        fetch(FONNTE_SEND_URL, {
          method: "POST",
          headers: {
            Authorization: this.config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }),
      );
      const result = await parseGatewayResponse(response, FONNTE_SEND_URL);

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

  private getMessageId(result: Record<string, unknown>): string | undefined {
    const id = result.id || result.message_id;
    return typeof id === "string" ? id : undefined;
  }
}
