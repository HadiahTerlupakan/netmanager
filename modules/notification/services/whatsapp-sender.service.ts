import { logger } from "@/lib/logger";
import { decryptApiKey } from "@/lib/utils/encryption";
import type { WhatsAppMessage } from "../domain/whatsapp-message.entity";
import type { WhatsAppAccount } from "../domain/whatsapp-account.entity";
import { WhatsAppAccountRepository } from "../repositories/whatsapp-account.repository";
import { WhatsAppMessageRepository } from "../repositories/whatsapp-message.repository";
import { WhatsAppFactory } from "./whatsapp/whatsapp-factory";
import type {
  SendMessageParams,
  SendFileParams,
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

export class WhatsAppSenderService {
  private accountRepo: WhatsAppAccountRepository;
  private messageRepo: WhatsAppMessageRepository;

  constructor(
    accountRepo?: WhatsAppAccountRepository,
    messageRepo?: WhatsAppMessageRepository,
  ) {
    this.accountRepo = accountRepo ?? new WhatsAppAccountRepository();
    this.messageRepo = messageRepo ?? new WhatsAppMessageRepository();
  }

  /**
   * Send WhatsApp message with auto-routing or specific account
   */
  async send(options: SendOptions): Promise<SendResult> {
    try {
      // Select account
      const account = options.accountId
        ? await this.accountRepo.findById(options.accountId)
        : await this.selectBestAccount(
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

      // Check daily limit
      if (account.dailyLimit && account.dailyCount >= account.dailyLimit) {
        // Try to find another account if auto-routing
        if (!options.accountId) {
          const alternativeAccount = await this.selectBestAccount(
            options.tenantId,
            [account.id],
            options.accountType,
          );
          if (alternativeAccount) {
            return this.sendViaAccount(alternativeAccount, options);
          }
        }

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
        await new Promise((resolve) => setTimeout(resolve, 100));
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
        await new Promise((resolve) => setTimeout(resolve, 100));
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
    const messageRecord = await this.messageRepo.create({
      accountId: account.id,
      phone: options.phone,
      message: options.message,
      fileUrl: options.fileUrl,
      status: "pending",
      tenantId: options.tenantId,
    });

    try {
      // Reset daily count if needed
      await this.resetDailyCountIfNeeded(account);

      // Build config
      const config: WhatsAppConfig = {
        provider: account.provider,
        apiKey: decryptApiKey(account.apiKey),
        domain: account.domain ?? undefined,
        deviceId: account.deviceId ?? undefined,
      };

      // Create provider
      const provider = WhatsAppFactory.createProvider(config);

      // Send message
      let result: SendResult;
      if (options.fileUrl) {
        const params: SendFileParams = {
          phone: options.phone,
          fileUrl: options.fileUrl,
          caption: options.message,
        };
        result = await provider.sendFile!(params);
      } else {
        const params: SendMessageParams = {
          phone: options.phone,
          message: options.message || "",
        };
        result = await provider.sendMessage(params);
      }

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
   * Select best available account based on priority and availability
   */
  private async selectBestAccount(
    tenantId?: string,
    excludeIds: string[] = [],
    accountType?: "CUSTOMER" | "INTERNAL",
  ): Promise<WhatsAppAccount | null> {
    // If accountType specified, try default for that type first
    if (accountType) {
      const defaultAccount = await this.accountRepo.findDefaultByAccountType(
        accountType,
        tenantId,
      );
      if (
        defaultAccount &&
        !excludeIds.includes(defaultAccount.id) &&
        this.isAccountAvailable(defaultAccount)
      ) {
        return defaultAccount;
      }

      // Get accounts filtered by type
      const accounts = await this.accountRepo.findByAccountType(
        accountType,
        tenantId,
      );
      const availableAccounts = accounts.filter(
        (acc) => !excludeIds.includes(acc.id) && this.isAccountAvailable(acc),
      );

      if (availableAccounts.length === 0) {
        return null;
      }

      // Sort by priority (highest first)
      availableAccounts.sort((a, b) => b.priority - a.priority);
      return availableAccounts[0];
    }

    // Original logic for no accountType filter
    // Try default first
    const defaultAccount = await this.accountRepo.findDefault(tenantId);
    if (
      defaultAccount &&
      !excludeIds.includes(defaultAccount.id) &&
      this.isAccountAvailable(defaultAccount)
    ) {
      return defaultAccount;
    }

    // Get all available accounts
    const accounts = await this.accountRepo.findAvailable(tenantId);
    const availableAccounts = accounts.filter(
      (acc) => !excludeIds.includes(acc.id) && this.isAccountAvailable(acc),
    );

    if (availableAccounts.length === 0) {
      return null;
    }

    // Sort by priority (highest first)
    availableAccounts.sort((a, b) => b.priority - a.priority);

    return availableAccounts[0];
  }

  /**
   * Check if account is available (not over daily limit)
   */
  private isAccountAvailable(account: WhatsAppAccount): boolean {
    if (!account.dailyLimit) {
      return true;
    }

    return account.dailyCount < account.dailyLimit;
  }

  /**
   * Reset daily count if 24 hours have passed
   */
  private async resetDailyCountIfNeeded(
    account: WhatsAppAccount,
  ): Promise<void> {
    const now = new Date();
    const hoursSinceReset =
      (now.getTime() - account.lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      await this.accountRepo.resetDailyCount(account.id);
      logger.info(
        `[WhatsAppSender] Reset daily count for account ${account.id}`,
      );
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
