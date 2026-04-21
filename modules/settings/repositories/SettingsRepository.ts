import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma, prismaAuth } from "@/modules/database";

export type SettingsRecord = {
  key: string;
  value: string | null;
  encrypted: boolean;
};

export type SettingsUpsertInput = {
  key: string;
  value: string | null;
  description?: string | null;
  encrypted?: boolean;
  tenantId?: string | null;
};

export const SettingsRepository = {
  findManyByKeys: async (
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<SettingsRecord[]> => {
    if (!keys.length) {
      return [];
    }

    const keysArray = [...keys];
    const normalizedTenantId = normalizeTenantId(tenantId);

    const settingsClient = normalizedTenantId === null ? prismaAuth : prisma;

    const settings = await settingsClient.settings.findMany({
      where: {
        tenantId: normalizedTenantId,
        key: {
          in: keysArray,
        },
      },
    });

    return settings.map(({ key, value, encrypted }) => ({
      key,
      value,
      encrypted,
    }));
  },

  upsertMany: async (entries: SettingsUpsertInput[]): Promise<void> => {
    if (!entries.length) {
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await upsertOne(tx, entry, now);
      }
    });
  },

  deleteManyByKeys: async (
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<void> => {
    if (!keys.length) {
      return;
    }

    const normalizedTenantId = normalizeTenantId(tenantId);

    await prisma.settings.deleteMany({
      where: {
        tenantId: normalizedTenantId,
        key: {
          in: [...keys],
        },
      },
    });
  },
};

function normalizeTenantId(tenantId?: string | null): string | null {
  return tenantId ?? null;
}

async function upsertOne(
  tx: Prisma.TransactionClient,
  entry: SettingsUpsertInput,
  now: Date,
) {
  const normalizedTenantId = normalizeTenantId(entry.tenantId);
  const where: Prisma.SettingsWhereInput = {
    key: entry.key,
    tenantId: normalizedTenantId,
  };

  const existing = await tx.settings.findFirst({ where });
  const value = entry.value ?? null;
  const description = entry.description ?? null;
  const encrypted = entry.encrypted ?? false;

  if (existing) {
    await tx.settings.update({
      where: { id: existing.id },
      data: {
        value,
        description,
        encrypted,
        updatedAt: now,
      },
    });
  } else {
    await tx.settings.create({
      data: {
        id: randomUUID(),
        key: entry.key,
        value,
        description,
        encrypted,
        tenantId: normalizedTenantId,
        updatedAt: now,
      },
    });
  }
}
