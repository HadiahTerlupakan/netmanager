import { prisma } from "@/lib/prisma";

import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { toSettingEntity } from "../mappers/AttendanceDomainMapper";

export class SettingsRepository implements ISettingsRepository {
  /**
   * Find a setting by key and optional tenantId.
   */
  async findByKey(key: string, tenantId?: string) {
    const setting = await prisma.settings.findFirst({
      where: {
        key,
        ...(tenantId && { tenantId }),
      },
    });

    return setting ? toSettingEntity(setting) : null;
  }

  /**
   * Find multiple settings by an array of keys.
   */
  async findManyByKeys(keys: string[]) {
    const settings = await prisma.settings.findMany({
      where: { key: { in: keys } },
    });

    return settings.map(toSettingEntity);
  }
}
