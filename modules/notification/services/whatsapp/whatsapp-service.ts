import { logger } from "@/lib/logger";
// WhatsApp Service - Main service for sending WhatsApp messages

import { AttendanceSettingsService } from "@/modules/attendance";
import { decryptApiKey } from "@/lib/utils/encryption";
import { WhatsAppFactory } from "./whatsapp-factory";
import type {
  WhatsAppConfig,
  SendMessageParams,
  SendFileParams,
  SendButtonParams,
  SendResult,
  WhatsAppProviderId,
} from "./whatsapp-provider-interface";

type WhatsAppSettingsProvider = () => Promise<Record<string, string>>;

export class WhatsAppService {
  private settingsRepo?: AttendanceSettingsService;
  private readonly settingsProvider?: WhatsAppSettingsProvider;

  constructor(
    settingsRepo?: AttendanceSettingsService,
    settingsProvider?: WhatsAppSettingsProvider,
  ) {
    this.settingsRepo = settingsRepo;
    this.settingsProvider = settingsProvider;
  }

  private getSettingsRepo(): AttendanceSettingsService {
    if (!this.settingsRepo) {
      this.settingsRepo = new AttendanceSettingsService();
    }

    return this.settingsRepo;
  }

  /**
   * Check if WhatsApp is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const settings = await this.getSettingsRepo().findManyByKeys([
        "WHATSAPP_API_KEY",
      ]);

      const apiKey = settings.find((s) => s.key === "WHATSAPP_API_KEY")?.value;
      const envKey = process.env.FONNTE_API_KEY;

      return !!(apiKey || envKey);
    } catch {
      return false;
    }
  }

  /** Load WhatsApp configuration from database or injected tenant settings. */
  private async loadConfig(): Promise<WhatsAppConfig | null> {
    const settingsMap = this.settingsProvider
      ? await this.settingsProvider()
      : await this.loadLegacySettingsMap();

    const provider =
      (settingsMap["WHATSAPP_PROVIDER"] as WhatsAppProviderId) ||
      (process.env.WHATSAPP_PROVIDER as WhatsAppProviderId) ||
      "WABLAS";
    const apiKey =
      settingsMap["WHATSAPP_API_KEY"] || process.env.FONNTE_API_KEY || "";

    if (!apiKey) {
      logger.warn("[WhatsApp] API key not configured, skipping message");
      return null;
    }

    return {
      provider,
      apiKey,
      domain: settingsMap["WABLAS_DOMAIN"] || process.env.WABLAS_DOMAIN,
      deviceId: settingsMap["WABLAS_DEVICE_ID"] || process.env.WABLAS_DEVICE_ID,
    };
  }

  private async loadLegacySettingsMap() {
    const settings = await this.getSettingsRepo().findManyByKeys([
      "WHATSAPP_PROVIDER",
      "WHATSAPP_API_KEY",
      "WABLAS_DOMAIN",
      "WABLAS_DEVICE_ID",
    ]);
    const settingsMap: Record<string, string> = {};

    for (const setting of settings) {
      settingsMap[setting.key] = this.resolveSettingValue(setting);
    }

    return settingsMap;
  }

  private resolveSettingValue(setting: { key: string; value?: string | null }) {
    if (setting.key !== "WHATSAPP_API_KEY" || !setting.value) {
      return setting.value || "";
    }

    try {
      return decryptApiKey(setting.value);
    } catch (error) {
      logger.error("[WhatsApp] Failed to decrypt API key:", error);
      return "";
    }
  }

  /**
   * Send text message
   */
  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    try {
      const config = await this.loadConfig();

      // Return gracefully if not configured
      if (!config) {
        return {
          success: false,
          error: "WhatsApp belum dikonfigurasi",
        };
      }

      const provider = WhatsAppFactory.createProvider(config);
      const result = await provider.sendMessage(params);

      if (result.success) {
      } else {
        logger.error(`[WhatsApp] Failed to send:`, result.error);
      }

      return result;
    } catch (error: unknown) {
      logger.error("[WhatsApp] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  /**
   * Send file with optional caption
   */
  async sendFile(params: SendFileParams): Promise<SendResult> {
    try {
      const config = await this.loadConfig();

      // Return gracefully if not configured
      if (!config) {
        return {
          success: false,
          error: "WhatsApp belum dikonfigurasi",
        };
      }

      const provider = WhatsAppFactory.createProvider(config);

      // Check if provider supports file sending
      if (!provider.sendFile) {
        throw new Error(
          `Provider ${config.provider} tidak mendukung pengiriman file`,
        );
      }
      const result = await provider.sendFile(params);

      if (result.success) {
      } else {
        logger.error(`[WhatsApp] Failed to send file:`, result.error);
      }

      return result;
    } catch (error: unknown) {
      logger.error("[WhatsApp] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  /**
   * Send interactive button message.
   */
  async sendButton(params: SendButtonParams): Promise<SendResult> {
    try {
      const config = await this.loadConfig();
      if (!config)
        return { success: false, error: "WhatsApp belum dikonfigurasi" };

      const provider = WhatsAppFactory.createProvider(config);
      const result = provider.sendButton
        ? await provider.sendButton(params)
        : await provider.sendMessage(this.toButtonFallbackMessage(params));
      if (!result.success)
        logger.error(`[WhatsApp] Failed to send button:`, result.error);
      return result;
    } catch (error: unknown) {
      logger.error("[WhatsApp] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  private toButtonFallbackMessage(params: SendButtonParams): SendMessageParams {
    const links = params.buttons
      .filter((button) => button.type === "url" && button.url)
      .map((button) => `${button.displayText}: ${button.url}`)
      .join("\n");
    const message = links ? `${params.message}\n\n${links}` : params.message;
    return { phone: params.phone, message };
  }

  /**
   * Test connection with current configuration
   */
  async testConnection(testPhone: string): Promise<SendResult> {
    return this.sendMessage({
      phone: testPhone,
      message: `✅ *Pesan Percobaan dari NetManager*\n\nAPI WhatsApp Anda telah dikonfigurasi dengan benar!\n\nTimestamp: ${new Date().toLocaleString("id-ID")}`,
    });
  }
}
