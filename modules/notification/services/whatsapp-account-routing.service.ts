import { logger } from "@/lib/logger";
import type { WhatsAppAccount } from "../domain/whatsapp-account.entity";
import type { WhatsAppAccountRepository } from "../repositories/whatsapp-account.repository";

const DAILY_RESET_HOURS = 24;
const HOUR_MS = 1000 * 60 * 60;

export class WhatsAppAccountRoutingService {
  constructor(private readonly accountRepo: WhatsAppAccountRepository) {}

  async findById(id: string): Promise<WhatsAppAccount | null> {
    const account = await this.accountRepo.findById(id);
    if (!account) {
      return null;
    }

    await this.resetDailyCountIfNeeded(account);
    return account;
  }

  async selectBestAccount(
    tenantId?: string,
    excludeIds: string[] = [],
    accountType?: "CUSTOMER" | "INTERNAL",
  ): Promise<WhatsAppAccount | null> {
    if (accountType) {
      const defaultAccount = await this.accountRepo.findDefaultByAccountType(
        accountType,
        tenantId,
      );
      const selectedDefault = await this.selectDefaultAccount(
        defaultAccount,
        excludeIds,
      );
      if (selectedDefault) {
        return selectedDefault;
      }

      const accounts = await this.accountRepo.findByAccountType(
        accountType,
        tenantId,
      );
      return this.selectHighestPriorityAvailableAccount(accounts, excludeIds);
    }

    const defaultAccount = await this.accountRepo.findDefault(tenantId);
    const selectedDefault = await this.selectDefaultAccount(
      defaultAccount,
      excludeIds,
    );
    if (selectedDefault) {
      return selectedDefault;
    }

    const accounts = await this.accountRepo.findAvailable(tenantId);
    return this.selectHighestPriorityAvailableAccount(accounts, excludeIds);
  }

  isAccountAvailable(account: WhatsAppAccount): boolean {
    if (!account.dailyLimit) {
      return true;
    }

    return account.dailyCount < account.dailyLimit;
  }

  async resetDailyCountIfNeeded(account: WhatsAppAccount): Promise<void> {
    const now = new Date();
    const hoursSinceReset =
      (now.getTime() - account.lastReset.getTime()) / HOUR_MS;

    if (hoursSinceReset >= DAILY_RESET_HOURS) {
      await this.accountRepo.resetDailyCount(account.id);
      account.dailyCount = 0;
      account.lastReset = now;
      logger.info(
        `[WhatsAppSender] Reset daily count for account ${account.id}`,
      );
    }
  }

  private async selectDefaultAccount(
    account: WhatsAppAccount | null,
    excludeIds: string[],
  ): Promise<WhatsAppAccount | null> {
    if (!account || excludeIds.includes(account.id)) {
      return null;
    }

    await this.resetDailyCountIfNeeded(account);
    return this.isAccountAvailable(account) ? account : null;
  }

  private async selectHighestPriorityAvailableAccount(
    accounts: WhatsAppAccount[],
    excludeIds: string[],
  ): Promise<WhatsAppAccount | null> {
    for (const account of accounts) {
      await this.resetDailyCountIfNeeded(account);
    }

    const availableAccounts = accounts.filter(
      (account) =>
        !excludeIds.includes(account.id) && this.isAccountAvailable(account),
    );

    if (availableAccounts.length === 0) {
      return null;
    }

    availableAccounts.sort((a, b) => b.priority - a.priority);
    return availableAccounts[0];
  }
}
