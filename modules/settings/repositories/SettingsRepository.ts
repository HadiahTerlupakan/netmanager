import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma, prismaAuth } from "@/modules/database";
import { encryptApiKey, decryptApiKey } from "@/lib/utils/encryption";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { toSettingsDomain } from "../mappers/settingsMapper";
import { SECRET_PLACEHOLDER } from "../constants/secretConstants";

export type SettingsRecord = SettingsEntity;
export type SettingsUpsertInput = SettingsUpsertEntity;

const settingsRepository: ISettingsRepository = {
  /** Finds settings records by keys within tenant scope. */
  async findManyByKeys(
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<SettingsEntity[]> {
    if (!keys.length) {
      return [];
    }

    const settingsClient = resolveSettingsClient(tenantId);
    const settings = await settingsClient.settings.findMany({
      where: buildFindManyWhere(keys, tenantId),
    });

    return settings.map((setting) => {
      const domain = toSettingsDomain(setting);

      // Decrypt encrypted values
      if (domain.encrypted && domain.value) {
        try {
          domain.value = decryptApiKey(domain.value);
        } catch (_error) {
          // Return placeholder on decryption failure
          domain.value = SECRET_PLACEHOLDER;
        }
      }

      return domain;
    });
  },

  /** Upserts multiple settings entries in a single transaction. */
  async upsertMany(entries: SettingsUpsertEntity[]): Promise<void> {
    if (!entries.length) {
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await upsertOne(tx, encryptEntryIfNeeded(entry), now);
      }
    });
  },

  /** Creates multiple new settings entries in a single transaction. */
  async createMany(entries: SettingsUpsertEntity[]): Promise<void> {
    if (!entries.length) {
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await createSetting(tx, encryptEntryIfNeeded(entry), now);
      }
    });
  },

  /** Updates multiple existing settings entries in a single transaction. */
  async updateMany(entries: SettingsUpsertEntity[]): Promise<void> {
    if (!entries.length) {
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const existing = await tx.settings.findFirst({
          where: buildUpsertWhere(entry),
        });

        if (!existing) {
          throw new Error(
            `Setting with key "${entry.key}" not found for tenant "${entry.tenantId}"`,
          );
        }

        await updateExistingSetting(
          tx,
          existing.id,
          encryptEntryIfNeeded(entry),
          now,
        );
      }
    });
  },

  /** Deletes settings records by keys within tenant scope. */
  async deleteManyByKeys(
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<void> {
    if (!keys.length) {
      return;
    }

    await prisma.settings.deleteMany({
      where: buildFindManyWhere(keys, tenantId),
    });
  },
};

export const SettingsRepository = settingsRepository;

/**
 * Encrypt entry value if marked as encrypted.
 */
function encryptEntryIfNeeded(
  entry: SettingsUpsertEntity,
): SettingsUpsertEntity {
  if (entry.encrypted && entry.value) {
    return {
      ...entry,
      value: encryptApiKey(entry.value),
    };
  }
  return entry;
}

function buildFindManyWhere(
  keys: ReadonlyArray<string>,
  tenantId?: string | null,
): Prisma.SettingsWhereInput {
  return {
    tenantId: normalizeTenantId(tenantId),
    key: { in: [...keys] },
  };
}

function resolveSettingsClient(tenantId?: string | null) {
  return normalizeTenantId(tenantId) === null ? prismaAuth : prisma;
}

function normalizeTenantId(tenantId?: string | null): string | null {
  return tenantId ?? null;
}

async function upsertOne(
  tx: Prisma.TransactionClient,
  entry: SettingsUpsertEntity,
  now: Date,
): Promise<void> {
  const existing = await tx.settings.findFirst({
    where: buildUpsertWhere(entry),
  });

  if (existing) {
    await updateExistingSetting(tx, existing.id, entry, now);
    return;
  }

  await createSetting(tx, entry, now);
}

function buildUpsertWhere(
  entry: SettingsUpsertEntity,
): Prisma.SettingsWhereInput {
  return {
    key: entry.key,
    tenantId: normalizeTenantId(entry.tenantId),
  };
}

function buildUpsertData(entry: SettingsUpsertEntity, now: Date) {
  return {
    value: entry.value ?? null,
    description: entry.description ?? null,
    encrypted: entry.encrypted ?? false,
    updatedAt: now,
  };
}

async function updateExistingSetting(
  tx: Prisma.TransactionClient,
  id: string,
  entry: SettingsUpsertEntity,
  now: Date,
): Promise<void> {
  await tx.settings.update({
    where: { id },
    data: buildUpsertData(entry, now),
  });
}

async function createSetting(
  tx: Prisma.TransactionClient,
  entry: SettingsUpsertEntity,
  now: Date,
): Promise<void> {
  await tx.settings.create({
    data: {
      id: randomUUID(),
      key: entry.key,
      tenantId: normalizeTenantId(entry.tenantId),
      ...buildUpsertData(entry, now),
    },
  });
}
