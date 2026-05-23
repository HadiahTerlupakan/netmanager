import { logger } from "@/lib/logger";
import type {
  EmailSettingsPayload,
  EmailTestServiceResult,
} from "./emailSettings";
import type { TenantSettingsMap } from "./tenantSettings";

export type EmailTestServiceSuccess = {
  type: "success";
  message: string;
  data: {
    testEmail: string;
    messageId: string;
  };
};

export type EmailTestServiceValidation = {
  type: "validation_error";
  message: string;
};

export type ResolvedEmailTestSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpPortValue: string;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  testEmail: string;
};

export function sanitizeString(value?: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function sanitizePassword(value?: string): string {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, "");
}

export function mapSettingsToPayload(
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

export function validateEmailTestSettings(
  settings: ResolvedEmailTestSettings,
): EmailTestServiceValidation | null {
  if (!settings.smtpHost) {
    return emailValidationError("SMTP host belum dikonfigurasi");
  }

  if (!settings.smtpPortValue || Number.isNaN(settings.smtpPort)) {
    return emailValidationError("Port SMTP tidak valid");
  }

  if (!settings.smtpUser) {
    return emailValidationError("SMTP user belum dikonfigurasi");
  }

  if (!settings.smtpPass) {
    return emailValidationError("SMTP password belum dikonfigurasi");
  }

  if (!settings.fromEmail) {
    return emailValidationError("Email pengirim belum dikonfigurasi");
  }

  if (!settings.testEmail) {
    return emailValidationError("Alamat email percobaan belum ditentukan");
  }

  return null;
}

function emailValidationError(message: string): EmailTestServiceValidation {
  return { type: "validation_error", message };
}

export function buildEmailTestSuccess(
  testEmail: string,
  messageId: string,
): EmailTestServiceSuccess {
  return {
    type: "success",
    message: `Email percobaan berhasil dikirim ke ${testEmail}`,
    data: { testEmail, messageId },
  };
}

export function logEmailTestFailure(
  options: { tenantId: string; userId: string },
  settings: ResolvedEmailTestSettings,
  error: unknown,
): EmailTestServiceResult {
  logger.error("Gagal mengirim email percobaan", error as Error, {
    tenantId: options.tenantId,
    userId: options.userId,
    testEmail: settings.testEmail,
    smtpHost: settings.smtpHost,
    smtpUser: settings.smtpUser,
  });

  return { type: "failure", message: "Gagal mengirim email percobaan" };
}
