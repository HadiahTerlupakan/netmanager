import { logger } from "@/lib/logger";
import { decryptApiKey } from "@/lib/utils/encryption";
import type { WhatsAppMessage } from "../domain/whatsapp-message.entity";
import type { WhatsAppAccount } from "../domain/whatsapp-account.entity";
import { WhatsAppAccountRepository } from "../repositories/whatsapp-account.repository";
import { WhatsAppMessageRepository } from "../repositories/whatsapp-message.repository";
import { WhatsAppAccountRoutingService } from "./whatsapp-account-routing.service";
import { WhatsAppProviderSendService } from "./whatsapp-provider-send.service";
import { WhatsAppFactory } from "./whatsapp/whatsapp-factory";
import { normalizeWhatsAppPhone } from "./whatsapp/whatsapp-gateway-utils";
import type {
  SendResult,
  WhatsAppConfig,
} from "./whatsapp/whatsapp-provider-interface";

export interface SendOptions {
  phone: string;
  message?: string;
  fileUrl?: string;
  accountId?: string; // Optional: auto-select if not provided
  accountType?: "CUSTOMER" | "INTERNAL"; // Optional: filter by account type
  tenantId?: string;
}

export interface BroadcastOptions {
  phones: string[];
  message?: string;
  fileUrl?: string;
  accountId?: string;
  accountType?: "CUSTOMER" | "INTERNAL";
  loadBalance?: boolean;
  tenantId?: string;
}

/** Jeda antar pesan saat broadcast — cegah rate-limit di provider WhatsApp. */
const BROADCAST_INTER_MESSAGE_DELAY_MS = 100;

export class WhatsAppSenderService {
  private accountRepo: WhatsAppAccountRepository;
  private messageRepo: WhatsAppMessageRepository;
  private accountRoutingService: WhatsAppAccountRoutingService;
  private providerSendService: WhatsAppProviderSendService;

  constructor(
    accountRepo?: WhatsAppAccountRepository,
    messageRepo?: WhatsAppMessageRepository,
  ) {
    this.accountRepo = accountRepo ?? new WhatsAppAccountRepository();
    this.messageRepo = messageRepo ?? new WhatsAppMessageRepository();
    this.accountRoutingService = new WhatsAppAccountRoutingService(
      this.accountRepo,
    );
    this.providerSendService = new WhatsAppProviderSendService();
  }

  /**
   * Send WhatsApp message with auto-routing or specific account
   */
  async send(options: SendOptions): Promise<SendResult> {
    try {
      const account = options.accountId
        ? await this.accountRoutingService.findById(options.accountId)
        : await this.accountRoutingService.selectBestAccount(
            options.tenantId,
            [],
            options.accountType,
          );

      if (!account) {
        return {
          success: false,
          error: options.accountId
            ? "Akun tidak ditemukan"
            : "Tidak ada akun WhatsApp yang tersedia",
        };
      }

      if (!this.accountRoutingService.isAccountAvailable(account)) {
        return {
          success: false,
          error: `Akun "${account.name}" telah mencapai batas harian (${account.dailyLimit} pesan)`,
        };
      }

      return this.sendViaAccount(account, options);
    } catch (error) {
      logger.error("[WhatsAppSender] Send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  /**
   * Broadcast to multiple phones with optional load balancing
   */
  async broadcast(options: BroadcastOptions): Promise<SendResult[]> {
    const results: SendResult[] = [];

    if (options.loadBalance && !options.accountId) {
      // Load balance across multiple accounts
      const accounts = options.accountType
        ? await this.accountRepo.findByAccountType(
            options.accountType,
            options.tenantId,
          )
        : await this.accountRepo.findAvailable(options.tenantId);

      if (accounts.length === 0) {
        return options.phones.map(() => ({
          success: false,
          error: "Tidak ada akun WhatsApp yang tersedia",
        }));
      }

      let accountIndex = 0;
      for (const phone of options.phones) {
        const account = accounts[accountIndex % accounts.length];
        const result = await this.sendViaAccount(account, {
          phone,
          message: options.message,
          fileUrl: options.fileUrl,
          tenantId: options.tenantId,
        });
        results.push(result);
        accountIndex++;

        // Small delay to prevent rate limiting
        await new Promise((resolve) =>
          setTimeout(resolve, BROADCAST_INTER_MESSAGE_DELAY_MS),
        );
      }
    } else {
      // Use single account for all
      for (const phone of options.phones) {
        const result = await this.send({
          phone,
          message: options.message,
          fileUrl: options.fileUrl,
          accountId: options.accountId,
          accountType: options.accountType,
          tenantId: options.tenantId,
        });
        results.push(result);

        // Small delay
        await new Promise((resolve) =>
          setTimeout(resolve, BROADCAST_INTER_MESSAGE_DELAY_MS),
        );
      }
    }

    return results;
  }

  /**
   * Send via specific account
   */
  private async sendViaAccount(
    account: WhatsAppAccount,
    options: SendOptions,
  ): Promise<SendResult> {
    // Create message record
    const normalizedPhone = normalizeWhatsAppPhone(options.phone);
    const messageRecord = await this.messageRepo.create({
      accountId: account.id,
      phone: normalizedPhone,
      message: options.message,
      fileUrl: options.fileUrl,
      status: "pending",
      tenantId: options.tenantId,
    });

    try {
      await this.accountRoutingService.resetDailyCountIfNeeded(account);

      // Build config
      const config: WhatsAppConfig = {
        provider: account.provider,
        apiKey:
          account.provider === "BAILEYS"
            ? account.apiKey || account.id
            : decryptApiKey(account.apiKey),
        domain: account.domain ?? undefined,
        deviceId: account.deviceId ?? undefined,
        accountId: account.id,
      };

      // Create provider
      const provider = WhatsAppFactory.createProvider(config);

      const result = await this.providerSendService.send(provider, {
        ...options,
        phone: normalizedPhone,
      });

      // Update message record
      if (result.success) {
        await this.messageRepo.updateStatus(
          messageRecord.id,
          "sent",
          undefined,
          result.messageId,
          result.response as Record<string, unknown>,
        );
        await this.accountRepo.incrementDailyCount(account.id);
        logger.info(
          `[WhatsAppSender] Sent via account ${account.name} to ${options.phone}`,
        );
      } else {
        await this.messageRepo.updateStatus(
          messageRecord.id,
          "failed",
          result.error,
        );
        logger.error(
          `[WhatsAppSender] Failed via account ${account.name}:`,
          result.error,
        );
      }

      return result;
    } catch (error) {
      // Update message as failed
      await this.messageRepo.updateStatus(
        messageRecord.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("[WhatsAppSender] Send via account error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  /**
   * Get message history
   */
  async getMessages(
    tenantId?: string,
    limit: number = 50,
  ): Promise<WhatsAppMessage[]> {
    return this.messageRepo.findRecent(tenantId, limit);
  }

  /**
   * Get stats for an account
   */
  async getAccountStats(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    return this.messageRepo.getStats(accountId, startDate, endDate);
  }
}
