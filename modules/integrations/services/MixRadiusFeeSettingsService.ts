import { randomUUID } from "crypto";

import { prisma } from "@/modules/database";

const SETTINGS_KEY = "mixradius_fees";
const DEFAULT_JSON = "{}";
const MIXRADIUS_FEE_DESCRIPTION =
  "Konfigurasi Fee Transaksi MixRadius (Payment Gateway)";

export class MixRadiusFeeSettingsService {
  /** Get MixRadius fee configuration payload. */
  async getConfig() {
    const setting = await prisma.settings.findFirst({
      where: { key: SETTINGS_KEY },
    });

    return setting?.value ? JSON.parse(setting.value) : {};
  }

  /** Save MixRadius fee configuration payload. */
  async saveConfig(payload: unknown) {
    const existing = await prisma.settings.findFirst({
      where: { key: SETTINGS_KEY },
    });

    if (existing) {
      const setting = await prisma.settings.update({
        where: { id: existing.id },
        data: {
          value: JSON.stringify(payload),
          updatedAt: new Date(),
        },
      });

      return JSON.parse(setting.value || DEFAULT_JSON);
    }

    const setting = await prisma.settings.create({
      data: {
        id: randomUUID(),
        key: SETTINGS_KEY,
        value: JSON.stringify(payload),
        description: MIXRADIUS_FEE_DESCRIPTION,
        encrypted: false,
        updatedAt: new Date(),
      },
    });

    return JSON.parse(setting.value || DEFAULT_JSON);
  }
}
