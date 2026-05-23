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
   * Saat tenantId diisi, hasil dibatasi ke tenant tersebut untuk mencegah
   * cross-tenant credential leak (mis. SMTP/WhatsApp API key per-tenant).
   */
  async findManyByKeys(keys: string[], tenantId?: string) {
    const settings = await prisma.settings.findMany({
      where: {
        key: { in: keys },
        ...(tenantId ? { tenantId } : {}),
      },
    });

    return settings.map(toSettingEntity);
  }
}
