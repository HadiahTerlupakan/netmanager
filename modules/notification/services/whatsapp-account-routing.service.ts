import { logger } from "@/lib/logger";
import type { WhatsAppAccount } from "../domain/whatsapp-account.entity";
import type { WhatsAppAccountRepository } from "../repositories/whatsapp-account.repository";
import { getBaileysSession } from "./whatsapp/baileys-session-manager";

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

  async isSessionReady(account: WhatsAppAccount): Promise<boolean> {
    if (account.provider !== "BAILEYS") {
      return true;
    }

    const sessionId = account.apiKey || account.id;
    const session = await getBaileysSession(sessionId);
    return session.status === "connected";
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
    if (!this.isAccountAvailable(account)) {
      return null;
    }
    if (!(await this.isSessionReady(account))) {
      logger.warn(
        `[WhatsAppSender] Skip default account ${account.name}: session not connected`,
      );
      return null;
    }
    return account;
  }

  private async selectHighestPriorityAvailableAccount(
    accounts: WhatsAppAccount[],
    excludeIds: string[],
  ): Promise<WhatsAppAccount | null> {
    for (const account of accounts) {
      await this.resetDailyCountIfNeeded(account);
    }

    const candidates = accounts
      .filter(
        (account) =>
          !excludeIds.includes(account.id) && this.isAccountAvailable(account),
      )
      .sort((a, b) => b.priority - a.priority);

    for (const account of candidates) {
      if (await this.isSessionReady(account)) {
        return account;
      }
      logger.warn(
        `[WhatsAppSender] Skip account ${account.name}: session not connected`,
      );
    }

    return null;
  }
}
