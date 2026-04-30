import nodemailer from "nodemailer";

import { encryptApiKey } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";
import type { SettingsUpsertEntity } from "../domain/entities/Settings";
import { getTenantSettingsMap, upsertTenantSettings } from "./tenantSettings";
import type { TenantSettingsMap } from "./tenantSettings";

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

type EmailTestServiceSuccess = {
  type: "success";
  message: string;
  data: {
    testEmail: string;
    messageId: string;
  };
};

type EmailTestServiceValidation = {
  type: "validation_error";
  message: string;
};

type EmailTestServiceFailure = {
  type: "failure";
  message: string;
};

export type EmailTestServiceResult =
  | EmailTestServiceSuccess
  | EmailTestServiceValidation
  | EmailTestServiceFailure;

type ResolvedEmailTestSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpPortValue: string;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  testEmail: string;
};

const sanitizeString = (value?: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const sanitizePassword = (value?: string): string => {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, "");
};

const buildTestEmailHtml = (testEmail: string) => `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #10b981;">✅ Tes Konfigurasi Email</h2>
      <p>Ini adalah email percobaan untuk memverifikasi konfigurasi email Anda.</p>
      <p style="margin-top: 20px; color: #10b981; font-weight: bold;">
          Jika Anda menerima email ini, konfigurasi Anda berfungsi dengan benar!
      </p>
      <p style="margin-top: 16px; font-size: 13px; color: #6b7280;">
          Dikirim ke ${testEmail}
      </p>
  </div>
`;

function mapSettingsToPayload(
  settingsMap: TenantSettingsMap,
): EmailSettingsPayload {
  return {
    smtpHost: settingsMap["SMTP_HOST"] || "",
    smtpPort: settingsMap["SMTP_PORT"] || "587",
    smtpUser: settingsMap["SMTP_USER"] || "",
    smtpPass: settingsMap["SMTP_PASS"] || "",
    fromName: settingsMap["FROM_NAME"] || "",
    fromEmail: settingsMap["FROM_EMAIL"] || "",
  };
}

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
  if (validation) return validation;
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

function validateEmailTestSettings(
  settings: ResolvedEmailTestSettings,
): EmailTestServiceValidation | null {
  if (!settings.smtpHost)
    return emailValidationError("SMTP host belum dikonfigurasi");
  if (!settings.smtpPortValue || Number.isNaN(settings.smtpPort))
    return emailValidationError("Port SMTP tidak valid");
  if (!settings.smtpUser)
    return emailValidationError("SMTP user belum dikonfigurasi");
  if (!settings.smtpPass)
    return emailValidationError("SMTP password belum dikonfigurasi");
  if (!settings.fromEmail)
    return emailValidationError("Email pengirim belum dikonfigurasi");
  if (!settings.testEmail)
    return emailValidationError("Alamat email percobaan belum ditentukan");
  return null;
}

function emailValidationError(message: string): EmailTestServiceValidation {
  return { type: "validation_error", message };
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
    logEmailTestFailure(options, settings, error);
    return { type: "failure", message: "Gagal mengirim email percobaan" };
  }
}

function createEmailTransporter(settings: ResolvedEmailTestSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
  });
}

function buildEmailTestSuccess(
  testEmail: string,
  messageId: string,
): EmailTestServiceSuccess {
  return {
    type: "success",
    message: `Email percobaan berhasil dikirim ke ${testEmail}`,
    data: { testEmail, messageId },
  };
}

function logEmailTestFailure(
  options: { tenantId: string; userId: string },
  settings: ResolvedEmailTestSettings,
  error: unknown,
) {
  logger.error("Gagal mengirim email percobaan", error as Error, {
    tenantId: options.tenantId,
    userId: options.userId,
    testEmail: settings.testEmail,
    smtpHost: settings.smtpHost,
    smtpUser: settings.smtpUser,
  });
}
