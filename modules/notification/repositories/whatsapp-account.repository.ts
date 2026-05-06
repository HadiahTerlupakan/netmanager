import { prisma } from "@/lib/prisma";
import type {
  WhatsAppAccount,
  WhatsAppAccountCreateInput,
  WhatsAppAccountUpdateInput,
} from "../domain/whatsapp-account.entity";

export class WhatsAppAccountRepository {
  async create(data: WhatsAppAccountCreateInput): Promise<WhatsAppAccount> {
    const result = await prisma.whatsAppAccount.create({
      data: {
        ...data,
        accountType: data.accountType ?? "CUSTOMER",
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        priority: data.priority ?? 0,
      },
    });
    return result as WhatsAppAccount;
  }

  async findById(id: string): Promise<WhatsAppAccount | null> {
    const result = await prisma.whatsAppAccount.findUnique({
      where: { id },
    });
    return result as WhatsAppAccount | null;
  }

  async findByPhone(
    phone: string,
    tenantId?: string,
  ): Promise<WhatsAppAccount | null> {
    const result = await prisma.whatsAppAccount.findUnique({
      where: {
        phone_tenantId: {
          phone,
          tenantId: tenantId ?? null,
        },
      },
    });
    return result as WhatsAppAccount | null;
  }

  async findDefault(tenantId?: string): Promise<WhatsAppAccount | null> {
    const result = await prisma.whatsAppAccount.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        tenantId: tenantId ?? null,
      },
    });
    return result as WhatsAppAccount | null;
  }

  async findAll(tenantId?: string): Promise<WhatsAppAccount[]> {
    const results = await prisma.whatsAppAccount.findMany({
      where: {
        tenantId: tenantId ?? null,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return results as WhatsAppAccount[];
  }

  async findActive(tenantId?: string): Promise<WhatsAppAccount[]> {
    const results = await prisma.whatsAppAccount.findMany({
      where: {
        isActive: true,
        tenantId: tenantId ?? null,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return results as WhatsAppAccount[];
  }

  async findAvailable(tenantId?: string): Promise<WhatsAppAccount[]> {
    const now = new Date();
    const accounts = await this.findActive(tenantId);

    return accounts.filter((account) => {
      // Reset daily count jika sudah lewat 24 jam
      const hoursSinceReset =
        (now.getTime() - account.lastReset.getTime()) / (1000 * 60 * 60);

      if (hoursSinceReset >= 24) {
        // Reset akan dilakukan di service layer
        return true;
      }

      // Check daily limit
      if (account.dailyLimit && account.dailyCount >= account.dailyLimit) {
        return false;
      }

      return true;
    });
  }

  async findByAccountType(
    accountType: "CUSTOMER" | "INTERNAL",
    tenantId?: string,
  ): Promise<WhatsAppAccount[]> {
    const results = await prisma.whatsAppAccount.findMany({
      where: {
        accountType,
        isActive: true,
        tenantId: tenantId ?? null,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return results as WhatsAppAccount[];
  }

  async findDefaultByAccountType(
    accountType: "CUSTOMER" | "INTERNAL",
    tenantId?: string,
  ): Promise<WhatsAppAccount | null> {
    const result = await prisma.whatsAppAccount.findFirst({
      where: {
        accountType,
        isDefault: true,
        isActive: true,
        tenantId: tenantId ?? null,
      },
    });
    return result as WhatsAppAccount | null;
  }

  async update(
    id: string,
    data: WhatsAppAccountUpdateInput,
  ): Promise<WhatsAppAccount> {
    const result = await prisma.whatsAppAccount.update({
      where: { id },
      data,
    });
    return result as WhatsAppAccount;
  }

  async delete(id: string): Promise<void> {
    await prisma.whatsAppAccount.delete({
      where: { id },
    });
  }

  async setDefault(id: string, tenantId?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Unset semua default
      await tx.whatsAppAccount.updateMany({
        where: {
          tenantId: tenantId ?? null,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      // Set yang baru sebagai default
      await tx.whatsAppAccount.update({
        where: { id },
        data: {
          isDefault: true,
        },
      });
    });
  }

  async incrementDailyCount(id: string): Promise<void> {
    await prisma.whatsAppAccount.update({
      where: { id },
      data: {
        dailyCount: {
          increment: 1,
        },
      },
    });
  }

  async resetDailyCount(id: string): Promise<void> {
    await prisma.whatsAppAccount.update({
      where: { id },
      data: {
        dailyCount: 0,
        lastReset: new Date(),
      },
    });
  }
}
