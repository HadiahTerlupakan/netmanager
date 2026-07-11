import { prisma } from "@/lib/prisma";
import { encryptApiKey } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";

const MIGRATED_PHONE_PLACEHOLDER = "628000000000";

type WhatsAppProvider = "FONNTE" | "WABLAS" | "MPWA" | "OFFICIAL";

const SETTINGS_KEYS = [
  "WHATSAPP_PROVIDER",
  "WHATSAPP_API_KEY",
  "WABLAS_DOMAIN",
  "WABLAS_DEVICE_ID",
] as const;

/**
 * Migrate existing WhatsApp settings to WhatsAppAccount table
 * Run this script once after deploying multi-WhatsApp feature
 */
async function migrateWhatsAppSettings() {
  try {
    logger.info("[Migration] Starting WhatsApp settings migration...");

    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    logger.info(`[Migration] Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      await migrateTenantWhatsAppSettings(tenant.id, tenant.name);
    }

    await migrateGlobalWhatsAppSettings();

    logger.info(
      "[Migration] WhatsApp settings migration completed successfully",
    );
  } catch (error) {
    logger.error("[Migration] Error during migration:", error);
    throw error;
  }
}

async function migrateTenantWhatsAppSettings(
  tenantId: string,
  tenantName: string,
) {
  const settingsMap = await loadSettingsMap(tenantId);

  if (!settingsMap.WHATSAPP_API_KEY) {
    logger.info(
      `[Migration] No WhatsApp API key for tenant ${tenantName}, skipping`,
    );
    return;
  }

  const existingAccount = await prisma.whatsAppAccount.findFirst({
    where: { tenantId },
  });

  if (existingAccount) {
    logger.info(
      `[Migration] WhatsApp account already exists for tenant ${tenantName}, skipping`,
    );
    return;
  }

  const account = await createAccountFromSettings(
    settingsMap,
    `${tenantName} - Default`,
    tenantId,
  );

  logger.info(
    `[Migration] Created WhatsApp account for tenant ${tenantName}: ${account.id}`,
  );
  logger.warn(
    `[Migration] ⚠️ Tenant ${tenantName}: phone diisi placeholder ${MIGRATED_PHONE_PLACEHOLDER} — admin WAJIB update via UI`,
  );
}

async function migrateGlobalWhatsAppSettings() {
  const settingsMap = await loadSettingsMap(null);

  if (!settingsMap.WHATSAPP_API_KEY) {
    return;
  }

  logger.info("[Migration] Processing global WhatsApp settings");

  const existingGlobalAccount = await prisma.whatsAppAccount.findFirst({
    where: { tenantId: null },
  });

  if (existingGlobalAccount) {
    logger.info("[Migration] Global WhatsApp account already exists, skipping");
    return;
  }

  const account = await createAccountFromSettings(
    settingsMap,
    "Global - Default",
    null,
  );

  logger.info(`[Migration] Created global WhatsApp account: ${account.id}`);
  logger.warn(
    `[Migration] ⚠️ Global account: phone diisi placeholder ${MIGRATED_PHONE_PLACEHOLDER} — admin WAJIB update via UI`,
  );
}

async function loadSettingsMap(
  tenantId: string | null,
): Promise<Record<string, string>> {
  const settings = await prisma.settings.findMany({
    where: { tenantId, key: { in: [...SETTINGS_KEYS] } },
  });

  const map: Record<string, string> = {};
  for (const setting of settings) {
    map[setting.key] = setting.value || "";
  }
  return map;
}

async function createAccountFromSettings(
  settingsMap: Record<string, string>,
  name: string,
  tenantId: string | null,
) {
  const provider = normalizeProvider(settingsMap.WHATSAPP_PROVIDER);
  const encryptedApiKey = ensureEncrypted(settingsMap.WHATSAPP_API_KEY);

  return prisma.whatsAppAccount.create({
    data: {
      name,
      phone: MIGRATED_PHONE_PLACEHOLDER,
      provider,
      apiKey: encryptedApiKey,
      domain: settingsMap.WABLAS_DOMAIN || null,
      deviceId: settingsMap.WABLAS_DEVICE_ID || null,
      isActive: true,
      isDefault: true,
      priority: 10,
      tenantId,
    },
  });
}

function normalizeProvider(value: string): WhatsAppProvider {
  const candidates: WhatsAppProvider[] = [
    "FONNTE",
    "WABLAS",
    "MPWA",
    "OFFICIAL",
  ];
  return candidates.includes(value as WhatsAppProvider)
    ? (value as WhatsAppProvider)
    : "FONNTE";
}

function ensureEncrypted(apiKey: string): string {
  // Format encrypted: "<iv-hex>:<ciphertext-hex>". Plain key tidak ada ":".
  return apiKey.includes(":") ? apiKey : encryptApiKey(apiKey);
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
