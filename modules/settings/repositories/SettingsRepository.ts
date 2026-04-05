import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/modules/database'

export type SettingsRecord = {
  key: string
  value: string | null
}

export type SettingsUpsertInput = {
  key: string
  value: string | null
  description?: string | null
  encrypted?: boolean
  tenantId?: string | null
}

export const SettingsRepository = {
  findManyByKeys: async (keys: ReadonlyArray<string>): Promise<SettingsRecord[]> => {
    if (!keys.length) {
      return []
    }

    const keysArray = [...keys]

    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: keysArray,
        },
      },
    })

    return settings.map(({ key, value }) => ({ key, value }))
  },

  upsertMany: async (entries: SettingsUpsertInput[]): Promise<void> => {
    if (!entries.length) {
      return
    }

    const now = new Date()
    await Promise.all(entries.map((entry) => upsertOne(entry, now)))
  },
}

async function upsertOne(entry: SettingsUpsertInput, now: Date) {
  const where: Prisma.SettingsWhereInput = { key: entry.key }
  if (entry.tenantId !== undefined) {
    where.tenantId = entry.tenantId
  }

  const existing = await prisma.settings.findFirst({ where })
  const value = entry.value ?? null
  const description = entry.description ?? null
  const encrypted = entry.encrypted ?? false

  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: {
        value,
        description,
        encrypted,
        updatedAt: now,
      },
    })
  } else {
    await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: entry.key,
        value,
        description,
        encrypted,
        tenantId: entry.tenantId ?? null,
        updatedAt: now,
      },
    })
  }
}
