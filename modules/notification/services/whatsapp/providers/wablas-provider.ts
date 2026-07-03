// Wablas WhatsApp Provider Implementation

import type {
  WhatsAppProvider,
  SendMessageParams,
  SendFileParams,
  SendResult,
  WhatsAppConfig,
} from "../whatsapp-provider-interface";
import { whatsAppThrottler } from "../whatsapp-throttler";

export class WablasProvider implements WhatsAppProvider {
  name = "Wablas";
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    try {
      if (!this.config.domain) {
        throw new Error("Domain Wablas belum dikonfigurasi");
      }

      const url = `https://${this.config.domain}/api/send-message`;

      // Use throttler to prevent spamming
      const response = await whatsAppThrottler.add(async () => {
        const form = new FormData();
        form.append("api_key", this.config.apiKey);
        form.append("number", params.phone);
        form.append("message", params.message);
        if (this.config.deviceId) {
          form.append("sender", this.config.deviceId);
        }
        return fetch(url, { method: "POST", body: form });
      });

      const result = await response.json();

      if (response.ok && result.status) {
        return {
          success: true,
          messageId:
            result.data?.messages?.[0]?.id || result.data?.id || result.id,
        };
      } else {
        return {
          success: false,
          error: result.message || "Gagal mengirim pesan",
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kesalahan jaringan",
      };
    }
  }

  async sendFile(params: SendFileParams): Promise<SendResult> {
    try {
      if (!this.config.domain) {
        throw new Error("Domain Wablas belum dikonfigurasi");
      }

      const url = `https://${this.config.domain}/api/send-document`;

      // Use throttler to prevent spamming
      const response = await whatsAppThrottler.add(async () => {
        const form = new FormData();
        form.append("api_key", this.config.apiKey);
        form.append("number", params.phone);
        form.append("document", params.fileUrl);
        form.append("caption", params.caption || "");
        form.append("filename", params.filename || "document.pdf");
        if (this.config.deviceId) {
          form.append("sender", this.config.deviceId);
        }
        return fetch(url, { method: "POST", body: form });
      });

      const result = await response.json();

      if (response.ok && result.status) {
        return {
          success: true,
          messageId:
            result.data?.messages?.[0]?.id || result.data?.id || result.id,
        };
      } else {
        return {
          success: false,
          error: result.message || "Gagal mengirim file",
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kesalahan jaringan",
      };
    }
  }
}
