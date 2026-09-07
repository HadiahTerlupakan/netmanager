process.env.IS_SEEDING = "true";
import "dotenv/config";

import { prismaAuth } from "../lib/prisma";
import { prismaBillingAuth } from "../lib/prisma-billing";
import {
  decryptApiKey,
  encryptApiKey,
  isEncryptedWithLegacyKey,
  isUsingLegacyEncryptionKey,
} from "../lib/utils/encryption";
import { logger } from "../lib/logger";

/**
 * Pindahkan kredensial tersimpan dari kunci enkripsi lama ke `ENCRYPTION_KEY`.
 *
 * Selama `ENCRYPTION_KEY` belum dipasang, seluruh ciphertext produksi memakai
 * kunci cadangan yang nilainya ada di repo ini. Dekripsi sudah menerima kedua
 * kunci, jadi aplikasi tetap jalan tanpa skrip ini — tetapi kunci lama baru
 * benar-benar bisa dipensiunkan setelah semua baris dipindahkan.
 *
 * Jalankan dengan `ENCRYPTION_KEY` yang baru sudah terpasang di environment:
 *   npm run secrets:reencrypt          # laporan saja, tidak menulis
 *   npm run secrets:reencrypt -- --apply
 */

interface EncryptedField {
  label: string;
  load: () => Promise<Array<{ id: string; value: string | null }>>;
  save: (id: string, value: string) => Promise<void>;
}

const encryptedFields: EncryptedField[] = [
  {
    label: "Settings.value (encrypted=true)",
    load: () =>
      prismaAuth.settings.findMany({
        where: { encrypted: true, value: { not: null } },
        select: { id: true, value: true },
      }),
    save: (id, value) =>
      prismaAuth.settings.update({ where: { id }, data: { value } }).then(),
  },
  {
    label: "WhatsAppAccount.apiKey",
    load: async () =>
      (
        await prismaAuth.whatsAppAccount.findMany({
          select: { id: true, apiKey: true },
        })
      ).map((row) => ({ id: row.id, value: row.apiKey })),
    save: (id, value) =>
      prismaAuth.whatsAppAccount
        .update({ where: { id }, data: { apiKey: value } })
        .then(),
  },
  {
    label: "AccelPppServer.radiusSecret",
    load: async () =>
      (
        await prismaAuth.accelPppServer.findMany({
          select: { id: true, radiusSecret: true },
        })
      ).map((row) => ({ id: row.id, value: row.radiusSecret })),
    save: (id, value) =>
      prismaAuth.accelPppServer
        .update({ where: { id }, data: { radiusSecret: value } })
        .then(),
  },
  {
    label: "AccelPppServer.cliPassword",
    load: async () =>
      (
        await prismaAuth.accelPppServer.findMany({
          where: { cliPassword: { not: null } },
          select: { id: true, cliPassword: true },
        })
      ).map((row) => ({ id: row.id, value: row.cliPassword })),
    save: (id, value) =>
      prismaAuth.accelPppServer
        .update({ where: { id }, data: { cliPassword: value } })
        .then(),
  },
  {
    label: "PaymentGatewayConfig.apiKey",
    load: async () =>
      (
        await prismaBillingAuth.paymentGatewayConfig.findMany({
          where: { apiKey: { not: null } },
          select: { id: true, apiKey: true },
        })
      ).map((row) => ({ id: row.id, value: row.apiKey })),
    save: (id, value) =>
      prismaBillingAuth.paymentGatewayConfig
        .update({ where: { id }, data: { apiKey: value } })
        .then(),
  },
  {
    label: "PaymentGatewayConfig.apiSecret",
    load: async () =>
      (
        await prismaBillingAuth.paymentGatewayConfig.findMany({
          where: { apiSecret: { not: null } },
          select: { id: true, apiSecret: true },
        })
      ).map((row) => ({ id: row.id, value: row.apiSecret })),
    save: (id, value) =>
      prismaBillingAuth.paymentGatewayConfig
        .update({ where: { id }, data: { apiSecret: value } })
        .then(),
  },
];

interface FieldReport {
  label: string;
  legacy: number;
  migrated: number;
  unreadable: number;
}

async function migrateField(
  field: EncryptedField,
  shouldApply: boolean,
): Promise<FieldReport> {
  const report: FieldReport = {
    label: field.label,
    legacy: 0,
    migrated: 0,
    unreadable: 0,
  };

  for (const row of await field.load()) {
    if (!row.value) continue;

    let needsMigration = false;
    try {
      needsMigration = isEncryptedWithLegacyKey(row.value);
    } catch {
      // Nilai yang bukan ciphertext (mis. baris lama berformat polos)
      // dibiarkan apa adanya; menyentuhnya justru merusak data.
      continue;
    }

    if (!needsMigration) continue;
    report.legacy++;

    let plaintext: string;
    try {
      plaintext = decryptApiKey(row.value);
    } catch {
      report.unreadable++;
      logger.error(`[Reencrypt] Tidak terbaca: ${field.label} id=${row.id}`);
      continue;
    }

    if (!shouldApply) continue;

    await field.save(row.id, encryptApiKey(plaintext));
    report.migrated++;
  }

  return report;
}

async function reencryptSecrets() {
  const shouldApply = process.argv.includes("--apply");

  if (isUsingLegacyEncryptionKey()) {
    logger.error(
      "[Reencrypt] ENCRYPTION_KEY belum diset — tidak ada kunci tujuan. Pasang dulu ENCRYPTION_KEY yang baru, lalu jalankan ulang.",
    );
    process.exitCode = 1;
    return;
  }

  logger.info(
    shouldApply
      ? "[Reencrypt] Mode tulis: baris kunci lama akan dienkripsi ulang."
      : "[Reencrypt] Mode laporan: tidak ada yang ditulis. Tambahkan --apply untuk menerapkan.",
  );

  const reports: FieldReport[] = [];
  for (const field of encryptedFields) {
    reports.push(await migrateField(field, shouldApply));
  }

  for (const report of reports) {
    logger.info(
      `[Reencrypt] ${report.label}: ${report.legacy} pakai kunci lama, ${report.migrated} dipindahkan, ${report.unreadable} tidak terbaca`,
    );
  }

  const unreadable = reports.reduce((sum, r) => sum + r.unreadable, 0);
  if (unreadable > 0) {
    logger.error(
      `[Reencrypt] ${unreadable} baris tidak bisa didekripsi dengan kunci mana pun — perlu diisi ulang manual.`,
    );
    process.exitCode = 1;
  }
}

reencryptSecrets()
  .catch((error) => {
    logger.error("[Reencrypt] gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaAuth.$disconnect();
    await prismaBillingAuth.$disconnect();
  });
