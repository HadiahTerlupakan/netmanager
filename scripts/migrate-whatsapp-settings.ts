import { prisma } from "@/lib/prisma";
import { encryptApiKey } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";

/**
 * Migrate existing WhatsApp settings to WhatsAppAccount table
 * Run this script once after deploying multi-WhatsApp feature
 */
async function migrateWhatsAppSettings() {
  try {
    logger.info("[Migration] Starting WhatsApp settings migration...");

    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    logger.info(`[Migration] Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      logger.info(
        `[Migration] Processing tenant: ${tenant.name} (${tenant.id})`,
      );

      // Get existing WhatsApp settings for this tenant
      const settings = await prisma.settings.findMany({
        where: {
          tenantId: tenant.id,
          key: {
            in: [
              "WHATSAPP_PROVIDER",
              "WHATSAPP_API_KEY",
              "WABLAS_DOMAIN",
              "WABLAS_DEVICE_ID",
            ],
          },
        },
      });

      if (settings.length === 0) {
        logger.info(
          `[Migration] No WhatsApp settings found for tenant ${tenant.name}`,
        );
        continue;
      }

      const settingsMap: Record<string, string> = {};
      for (const setting of settings) {
        settingsMap[setting.key] = setting.value || "";
      }

      // Check if API key exists
      const apiKey = settingsMap["WHATSAPP_API_KEY"];
      if (!apiKey) {
        logger.info(
          `[Migration] No API key found for tenant ${tenant.name}, skipping`,
        );
        continue;
      }

      // Check if account already exists
      const existingAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          tenantId: tenant.id,
        },
      });

      if (existingAccount) {
        logger.info(
          `[Migration] WhatsApp account already exists for tenant ${tenant.name}, skipping`,
        );
        continue;
      }

      // Create WhatsApp account from settings
      const provider = settingsMap["WHATSAPP_PROVIDER"] || "FONNTE";
      const domain = settingsMap["WABLAS_DOMAIN"];
      const deviceId = settingsMap["WABLAS_DEVICE_ID"];

      // API key might already be encrypted in settings
      let encryptedApiKey = apiKey;
      try {
        // Try to use it as-is (might already be encrypted)
        // If it's not encrypted, encrypt it
        if (!apiKey.includes(":")) {
          encryptedApiKey = encryptApiKey(apiKey);
        }
      } catch (error) {
        logger.warn(
          `[Migration] Could not process API key for tenant ${tenant.name}:`,
          error,
        );
        continue;
      }

      const account = await prisma.whatsAppAccount.create({
        data: {
          name: `${tenant.name} - Default`,
          phone: "628000000000", // Placeholder, admin should update
          provider: provider as any,
          apiKey: encryptedApiKey,
          domain: domain || null,
          deviceId: deviceId || null,
          isActive: true,
          isDefault: true,
          priority: 10,
          tenantId: tenant.id,
        },
      });

      logger.info(
        `[Migration] Created WhatsApp account for tenant ${tenant.name}: ${account.id}`,
      );
    }

    // Also check for global settings (no tenantId)
    const globalSettings = await prisma.settings.findMany({
      where: {
        tenantId: null,
        key: {
          in: [
            "WHATSAPP_PROVIDER",
            "WHATSAPP_API_KEY",
            "WABLAS_DOMAIN",
            "WABLAS_DEVICE_ID",
          ],
        },
      },
    });

    if (globalSettings.length > 0) {
      logger.info("[Migration] Processing global WhatsApp settings");

      const globalSettingsMap: Record<string, string> = {};
      for (const setting of globalSettings) {
        globalSettingsMap[setting.key] = setting.value || "";
      }

      const globalApiKey = globalSettingsMap["WHATSAPP_API_KEY"];
      if (globalApiKey) {
        const existingGlobalAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            tenantId: null,
          },
        });

        if (!existingGlobalAccount) {
          const provider = globalSettingsMap["WHATSAPP_PROVIDER"] || "FONNTE";
          const domain = globalSettingsMap["WABLAS_DOMAIN"];
          const deviceId = globalSettingsMap["WABLAS_DEVICE_ID"];

          let encryptedApiKey = globalApiKey;
          try {
            if (!globalApiKey.includes(":")) {
              encryptedApiKey = encryptApiKey(globalApiKey);
            }
          } catch (error) {
            logger.warn("[Migration] Could not process global API key:", error);
          }

          const account = await prisma.whatsAppAccount.create({
            data: {
              name: "Global - Default",
              phone: "628000000000",
              provider: provider as any,
              apiKey: encryptedApiKey,
              domain: domain || null,
              deviceId: deviceId || null,
              isActive: true,
              isDefault: true,
              priority: 10,
              tenantId: null,
            },
          });

          logger.info(
            `[Migration] Created global WhatsApp account: ${account.id}`,
          );
        }
      }
    }

    logger.info(
      "[Migration] WhatsApp settings migration completed successfully",
    );
  } catch (error) {
    logger.error("[Migration] Error during migration:", error);
    throw error;
  }
}

// Run migration
migrateWhatsAppSettings()
  .then(() => {
    console.log("✅ Migration completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
