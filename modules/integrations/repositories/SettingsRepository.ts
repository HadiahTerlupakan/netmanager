import { prisma } from "@/modules/database";

import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

export class SettingsRepository implements ISettingsRepository {
  /** Find a setting by key. */
  async findByKey(key: string) {
    return prisma.settings.findFirst({
      where: { key },
      select: { key: true, value: true },
    });
  }
}
