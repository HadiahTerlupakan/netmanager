import type {
  SendFileParams,
  SendMessageParams,
  SendResult,
  WhatsAppProvider,
} from "./whatsapp/whatsapp-provider-interface";
import type { SendOptions } from "./whatsapp-sender.service";

export class WhatsAppProviderSendService {
  send(provider: WhatsAppProvider, options: SendOptions): Promise<SendResult> {
    if (!options.fileUrl) {
      const params: SendMessageParams = {
        phone: options.phone,
        message: options.message || "",
      };
      return provider.sendMessage(params);
    }

    if (!provider.sendFile) {
      return Promise.resolve({
        success: false,
        error: `Provider ${provider.name} tidak mendukung pengiriman file`,
      });
    }

    const params: SendFileParams = {
      phone: options.phone,
      fileUrl: options.fileUrl,
      caption: options.message,
    };
    return provider.sendFile(params);
  }
}
