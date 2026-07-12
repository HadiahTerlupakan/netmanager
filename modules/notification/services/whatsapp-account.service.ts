import { logger } from "@/lib/logger";
import { decryptApiKey, encryptApiKey } from "@/lib/utils/encryption";
import type {
  WhatsAppAccount,
  WhatsAppAccountCreateInput,
  WhatsAppAccountUpdateInput,
} from "../domain/whatsapp-account.entity";
import { WhatsAppAccountRepository } from "../repositories/whatsapp-account.repository";
import { WhatsAppMessageRepository } from "../repositories/whatsapp-message.repository";
import { WhatsAppFactory } from "./whatsapp/whatsapp-factory";
import type { WhatsAppConfig } from "./whatsapp/whatsapp-provider-interface";

type WhatsAppAccountResult = {
  success: boolean;
  data?: WhatsAppAccount;
  error?: string;
};

type WhatsAppActionResult = {
  success: boolean;
  error?: string;
};

export class WhatsAppAccountService {
  private repository: WhatsAppAccountRepository;
  private messageRepository: WhatsAppMessageRepository;

  constructor(
    repository?: WhatsAppAccountRepository,
    messageRepository?: WhatsAppMessageRepository,
  ) {
    this.repository = repository ?? new WhatsAppAccountRepository();
    this.messageRepository =
      messageRepository ?? new WhatsAppMessageRepository();
  }

  private isTenantAccount(
    account: WhatsAppAccount,
    tenantId?: string,
  ): boolean {
    return (account.tenantId ?? undefined) === tenantId;
  }

  private async findTenantAccount(
    id: string,
    tenantId?: string,
  ): Promise<WhatsAppAccount | null> {
    const account = await this.repository.findById(id);
    if (!account || !this.isTenantAccount(account, tenantId)) {
      return null;
    }

    return account;
  }

  async create(
    data: WhatsAppAccountCreateInput,
  ): Promise<{ success: boolean; data?: WhatsAppAccount; error?: string }> {
    try {
      // Check if phone already exists
      const existing = await this.repository.findByPhone(
        data.phone,
        data.tenantId,
      );
      if (existing) {
        return {
          success: false,
          error: "Nomor telepon sudah terdaftar",
        };
      }

      // Encrypt API key
      const encryptedApiKey = encryptApiKey(data.apiKey);

      // Create account
      const account = await this.repository.create({
        ...data,
        apiKey: encryptedApiKey,
      });

      logger.info(`[WhatsAppAccount] Created account: ${account.id}`);

      return { success: true, data: account };
    } catch (error) {
      logger.error("[WhatsAppAccount] Create error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  async update(
    id: string,
    data: WhatsAppAccountUpdateInput,
    tenantId?: string,
  ): Promise<WhatsAppAccountResult> {
    try {
      const existing = await this.findTenantAccount(id, tenantId);
      if (!existing) {
        return {
          success: false,
          error: "Akun tidak ditemukan",
        };
      }

      // If phone is being updated, check uniqueness
      if (data.phone && data.phone !== existing.phone) {
        const phoneExists = await this.repository.findByPhone(
          data.phone,
          existing.tenantId ?? undefined,
        );
        if (phoneExists) {
          return {
            success: false,
            error: "Nomor telepon sudah terdaftar",
          };
        }
      }

      // Encrypt API key if provided
      const updateData = { ...data };
      if (data.apiKey) {
        updateData.apiKey = encryptApiKey(data.apiKey);
      }

      const account = await this.repository.update(id, updateData);

      logger.info(`[WhatsAppAccount] Updated account: ${id}`);

      return { success: true, data: account };
    } catch (error) {
      logger.error("[WhatsAppAccount] Update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  async delete(id: string, tenantId?: string): Promise<WhatsAppActionResult> {
    try {
      const existing = await this.findTenantAccount(id, tenantId);
      if (!existing) {
        return {
          success: false,
          error: "Akun tidak ditemukan",
        };
      }

      await this.repository.delete(id);

      logger.info(`[WhatsAppAccount] Deleted account: ${id}`);

      return { success: true };
    } catch (error) {
      logger.error("[WhatsAppAccount] Delete error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  async findById(
    id: string,
    tenantId?: string,
  ): Promise<WhatsAppAccount | null> {
    return this.findTenantAccount(id, tenantId);
  }

  async findAll(tenantId?: string): Promise<WhatsAppAccount[]> {
    return this.repository.findAll(tenantId);
  }

  async findActive(tenantId?: string): Promise<WhatsAppAccount[]> {
    return this.repository.findActive(tenantId);
  }

  async setDefault(
    id: string,
    tenantId?: string,
  ): Promise<WhatsAppActionResult> {
    try {
      const account = await this.findTenantAccount(id, tenantId);
      if (!account) {
        return {
          success: false,
          error: "Akun tidak ditemukan",
        };
      }

      await this.repository.setDefault(id, tenantId);

      logger.info(`[WhatsAppAccount] Set default account: ${id}`);

      return { success: true };
    } catch (error) {
      logger.error("[WhatsAppAccount] Set default error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }

  async testConnection(
    id: string,
    tenantId?: string,
  ): Promise<WhatsAppActionResult> {
    let messageRecordId: string | null = null;

    try {
      const account = await this.findTenantAccount(id, tenantId);
      if (!account) {
        return {
          success: false,
          error: "Akun tidak ditemukan",
        };
      }

      const testMessage = `✅ *Test Connection*\n\nAkun WhatsApp "${account.name}" berhasil terhubung!\n\nTimestamp: ${new Date().toLocaleString("id-ID")}`;

      const config: WhatsAppConfig = {
        provider: account.provider,
        apiKey: decryptApiKey(account.apiKey),
        domain: account.domain ?? undefined,
        deviceId: account.deviceId ?? undefined,
      };

      const provider = WhatsAppFactory.createProvider(config);

      const messageRecord = await this.messageRepository.create({
        accountId: account.id,
        phone: account.phone,
        message: testMessage,
        status: "pending",
        tenantId: account.tenantId ?? undefined,
      });
      messageRecordId = messageRecord.id;

      const result = await provider.sendMessage({
        phone: account.phone,
        message: testMessage,
      });

      if (result.success) {
        await this.messageRepository.updateStatus(
          messageRecord.id,
          "sent",
          undefined,
          result.messageId,
          result.response as Record<string, unknown>,
        );
        await this.repository.incrementDailyCount(account.id);
        logger.info(`[WhatsAppAccount] Test connection success: ${id}`);
      } else {
        await this.messageRepository.updateStatus(
          messageRecord.id,
          "failed",
          result.error,
        );
        logger.error(
          `[WhatsAppAccount] Test connection failed: ${id}`,
          result.error,
        );
      }

      return result;
    } catch (error) {
      if (messageRecordId) {
        await this.messageRepository
          .updateStatus(
            messageRecordId,
            "failed",
            error instanceof Error ? error.message : "Unknown error",
          )
          .catch((updateErr: unknown) =>
            logger.error(
              "[WhatsAppAccount] Failed to mark test message as failed:",
              updateErr,
            ),
          );
      }
      logger.error("[WhatsAppAccount] Test connection error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      };
    }
  }
}
