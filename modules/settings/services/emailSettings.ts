import { logger } from "@/lib/logger";
import { encryptApiKey } from "@/lib/utils/encryption";
import type { SettingsUpsertEntity } from "../domain/entities/Settings";
import {
  buildEmailTestSuccess,
  buildTestEmailHtml,
  createEmailTransporter,
  logEmailTestFailure,
  mapSettingsToPayload,
  sanitizePassword,
  sanitizeString,
  type EmailTestServiceSuccess,
  type EmailTestServiceValidation,
  type ResolvedEmailTestSettings,
  validateEmailTestSettings,
} from "./emailSettings.helpers";
import { getTenantSettingsMap, upsertTenantSettings } from "./tenantSettings";

export type EmailSettingsPayload = {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
};

export type EmailSettingsUpdatePayload = Omit<
  EmailSettingsPayload,
  "smtpPass"
> & {
  smtpPass?: string;
};

export type EmailTestPayload = Partial<EmailSettingsPayload> & {
  testEmail?: string;
};

export const EMAIL_SETTINGS_FIELDS = [
  { key: "SMTP_HOST", defaultValue: "" },
  { key: "SMTP_PORT", defaultValue: "587" },
  { key: "SMTP_USER", defaultValue: "" },
  { key: "SMTP_PASS", defaultValue: "", decryptValue: true },
  { key: "FROM_NAME", defaultValue: "" },
  { key: "FROM_EMAIL", defaultValue: "" },
] as const;

type EmailTestServiceFailure = {
  type: "failure";
  message: string;
};

export type EmailTestServiceResult =
  | EmailTestServiceSuccess
  | EmailTestServiceValidation
  | EmailTestServiceFailure;

export async function getEmailSettings(
  tenantId: string,
): Promise<EmailSettingsPayload> {
  const settingsMap = await getTenantSettingsMap(
    tenantId,
    EMAIL_SETTINGS_FIELDS,
  );
  return mapSettingsToPayload(settingsMap);
}

export async function updateEmailSettings(
  tenantId: string,
  userId: string,
  payload: EmailSettingsUpdatePayload,
): Promise<void> {
  const sanitizedHost = sanitizeString(payload.smtpHost);
  const sanitizedPort = sanitizeString(payload.smtpPort);
  const sanitizedUser = sanitizeString(payload.smtpUser);
  const sanitizedFromName = sanitizeString(payload.fromName);
  const sanitizedFromEmail = sanitizeString(payload.fromEmail);
  const sanitizedPass = sanitizePassword(payload.smtpPass);

  const entries: SettingsUpsertEntity[] = [
    {
      key: "SMTP_HOST",
      value: sanitizedHost,
      description: "Email configuration: SMTP_HOST",
    },
    {
      key: "SMTP_PORT",
      value: sanitizedPort,
      description: "Email configuration: SMTP_PORT",
    },
    {
      key: "SMTP_USER",
      value: sanitizedUser,
      description: "Email configuration: SMTP_USER",
    },
    {
      key: "FROM_NAME",
      value: sanitizedFromName,
      description: "Email configuration: FROM_NAME",
    },
    {
      key: "FROM_EMAIL",
      value: sanitizedFromEmail,
      description: "Email configuration: FROM_EMAIL",
    },
  ];

  if (sanitizedPass) {
    entries.push({
      key: "SMTP_PASS",
      value: encryptApiKey(sanitizedPass),
      encrypted: true,
      description: "Email configuration: SMTP_PASS",
    });
  }

  await upsertTenantSettings(tenantId, entries);

  await logger.logActivity({
    action: "UPDATE",
    subject: "Email Settings",
    details: {
      smtpHost: sanitizedHost,
      smtpPort: sanitizedPort,
      smtpUser: sanitizedUser,
      fromName: sanitizedFromName,
      fromEmail: sanitizedFromEmail,
      updatedFields: entries.map((setting) => setting.key),
    },
    userId,
  });
}

export async function testEmailSettings(options: {
  tenantId: string;
  userId: string;
  payload?: EmailTestPayload;
}): Promise<EmailTestServiceResult> {
  const settings = await resolveEmailTestSettings(
    options.tenantId,
    options.payload,
  );
  const validation = validateEmailTestSettings(settings);
  if (validation) {
    return validation;
  }

  return sendTestEmail(options, settings);
}

async function resolveEmailTestSettings(
  tenantId: string,
  payload?: EmailTestPayload,
): Promise<ResolvedEmailTestSettings> {
  const settingsMap = await getTenantSettingsMap(
    tenantId,
    EMAIL_SETTINGS_FIELDS,
  );
  const smtpPortValue =
    sanitizeString(payload?.smtpPort) || settingsMap["SMTP_PORT"];
  const smtpUser =
    sanitizeString(payload?.smtpUser) || settingsMap["SMTP_USER"];
  const fromEmail =
    sanitizeString(payload?.fromEmail) || settingsMap["FROM_EMAIL"] || smtpUser;

  return {
    smtpHost: sanitizeString(payload?.smtpHost) || settingsMap["SMTP_HOST"],
    smtpPort: Number.parseInt(smtpPortValue, 10),
    smtpPortValue,
    smtpUser,
    smtpPass: sanitizePassword(payload?.smtpPass) || settingsMap["SMTP_PASS"],
    fromName:
      sanitizeString(payload?.fromName) ||
      settingsMap["FROM_NAME"] ||
      "NetManager ISP",
    fromEmail,
    testEmail: sanitizeString(payload?.testEmail) || fromEmail || smtpUser,
  };
}

async function sendTestEmail(
  options: { tenantId: string; userId: string },
  settings: ResolvedEmailTestSettings,
): Promise<EmailTestServiceResult> {
  try {
    const mailInfo = await createEmailTransporter(settings).sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: settings.testEmail,
      subject: "Email Percobaan dari NetManager",
      html: buildTestEmailHtml(settings.testEmail),
    });

    return buildEmailTestSuccess(settings.testEmail, mailInfo.messageId);
  } catch (error) {
    return logEmailTestFailure(options, settings, error);
  }
}
