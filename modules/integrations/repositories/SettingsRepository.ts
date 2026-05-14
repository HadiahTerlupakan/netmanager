import { randomUUID } from "crypto";

import { prisma } from "@/modules/database";

import type {
  ISettingsRepository,
  UpsertSettingInput,
} from "../domain/ports/ISettingsRepository";

export class SettingsRepository implements ISettingsRepository {
  async findByKey(key: string) {
    return prisma.settings.findFirst({
      where: { key },
      select: { key: true, value: true },
    });
  }

  async upsertByKey(input: UpsertSettingInput) {
    const existing = await prisma.settings.findFirst({
      where: { key: input.key },
    });

    if (existing) {
      const updated = await prisma.settings.update({
        where: { id: existing.id },
        data: { value: input.value, updatedAt: new Date() },
        select: { key: true, value: true },
      });
      return updated;
    }

    const created = await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: input.key,
        value: input.value,
        description: input.description ?? "",
        encrypted: false,
        updatedAt: new Date(),
      },
      select: { key: true, value: true },
    });
    return created;
  }
}
