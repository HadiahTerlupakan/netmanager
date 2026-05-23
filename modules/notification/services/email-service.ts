import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger";
import { validateEmail } from "@/lib/utils/validation";
import {
  EMAIL_SETTINGS_FIELDS,
  getTenantSettingsMap,
} from "@/modules/settings";
import { EmailDeliveryLogRepository } from "../repositories/EmailDeliveryLogRepository";
import {
  classifyEmailError,
  type EmailErrorCategory,
} from "./email-error-classifier";

/**
 * Konfigurasi SMTP runtime — port sudah di-parse ke number, password sudah di-decrypt.
 * Boundary type (EmailSettingsPayload di modules/settings) pakai string port karena
 * berasal dari form/DB; di-convert ke EmailConfig saat masuk transport layer.
 */
export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  /** HTML body. Wajib diisi atau bersamaan dengan `text`. */
  html?: string;
  /** Plain text body — preserve newline natural untuk template email. */
  text?: string;
  /** Wajib di multi-tenant — config SMTP di-load per tenant. */
  tenantId: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  /**
   * Opsional: cegah double-send dengan recipient+subject yang sama dalam
   * window waktu (default 0 = disabled). Diperiksa via EmailDeliveryLog.
   * Set ke 5 menit (300_000) untuk reminder/scheduler yang rentan duplicate.
   */
  dedupeWindowMs?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCategory?: EmailErrorCategory;
  /** True jika email di-skip oleh dedup guard (bukan failure). */
  deduped?: boolean;
}

const DEFAULT_FROM_NAME = "NetManager ISP";
const TEST_EMAIL_SUBJECT = "Email Percobaan dari NetManager";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_SINGLE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export class EmailService {
  private readonly logRepo: EmailDeliveryLogRepository;

  constructor(
    logRepo: EmailDeliveryLogRepository = new EmailDeliveryLogRepository(),
  ) {
    this.logRepo = logRepo;
  }

  /**
   * Kirim email per tenant dengan delivery logging.
   * Log PENDING dibuat dulu, lalu di-update ke SENT/FAILED setelah kirim.
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const attachmentError = validateAttachments(params.attachments);
    if (attachmentError) {
      return { success: false, error: attachmentError };
    }

    if (!params.html && !params.text) {
      return { success: false, error: "Body email kosong (html/text wajib)" };
    }

    if (params.dedupeWindowMs && params.dedupeWindowMs > 0) {
      const recent = await this.logRepo.hasRecentDelivery({
        to: params.to,
        subject: params.subject,
        tenantId: params.tenantId,
        sinceMs: params.dedupeWindowMs,
      });
      if (recent) {
        logger.info("[Email] Skip duplicate send (dedup)", {
          to: params.to,
          subject: params.subject,
          tenantId: params.tenantId,
          windowMs: params.dedupeWindowMs,
        });
        return { success: true, deduped: true };
      }
    }

    const logId = await this.logRepo.logAttempt({
      to: params.to,
      subject: params.subject,
      tenantId: params.tenantId,
    });

    try {
      const config = await loadEmailConfig(params.tenantId);
      const info = await createTransporter(config).sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments,
      });

      await this.logRepo.markSent(logId, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return this.handleSendFailure(logId, params.tenantId, error);
    }
  }

  /** Test koneksi SMTP — pakai konfigurasi tenant yang sudah tersimpan. */
  async testConnection(
    tenantId: string,
    testEmail: string,
  ): Promise<SendEmailResult> {
    return this.sendEmail({
      to: testEmail,
      tenantId,
      ...buildTestEmailPayload(testEmail),
    });
  }

  /**
   * Test koneksi SMTP dengan config eksplisit (tidak load dari DB).
   * Dipakai oleh halaman pengaturan email untuk test sebelum simpan setting.
   * Tidak menulis log delivery — hanya verifikasi konektivitas.
   */
  async testWithConfig(
    config: EmailConfig,
    testEmail: string,
  ): Promise<SendEmailResult> {
    const payload = buildTestEmailPayload(testEmail);
    try {
      const info = await createTransporter(config).sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: testEmail,
        subject: payload.subject,
        html: payload.html,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const classified = classifyEmailError(error);
      logger.error("[Email] Test koneksi gagal", error as Error, {
        category: classified.category,
      });
      return {
        success: false,
        error: classified.safeMessage,
        errorCategory: classified.category,
      };
    }
  }

  private async handleSendFailure(
    logId: string,
    tenantId: string,
    error: unknown,
  ): Promise<SendEmailResult> {
    const classified = classifyEmailError(error);
    logger.error("[Email] Pengiriman gagal", error as Error, {
      tenantId,
      category: classified.category,
    });

    await this.logRepo.markFailed(
      logId,
      classified.safeMessage,
      classified.category,
    );
    return {
      success: false,
      error: classified.safeMessage,
      errorCategory: classified.category,
    };
  }
}

/**
 * Load konfigurasi SMTP untuk tenant tertentu.
 * Throw kalau field wajib (host/user/pass/fromEmail) tidak terisi atau invalid.
 */
async function loadEmailConfig(tenantId: string): Promise<EmailConfig> {
  if (!tenantId) {
    throw new Error("tenantId wajib diisi untuk loadEmailConfig");
  }

  const settingsMap = await getTenantSettingsMap(
    tenantId,
    EMAIL_SETTINGS_FIELDS,
  );

  const smtpHost = settingsMap["SMTP_HOST"] ?? "";
  const smtpUser = settingsMap["SMTP_USER"] ?? "";
  const smtpPass = settingsMap["SMTP_PASS"] ?? "";
  const fromEmail = settingsMap["FROM_EMAIL"] || smtpUser;
  const fromName = settingsMap["FROM_NAME"] || DEFAULT_FROM_NAME;
  const smtpPort = parseSmtpPort(settingsMap["SMTP_PORT"]);

  if (!smtpHost) throw new Error("SMTP host belum dikonfigurasi");
  if (!smtpUser) throw new Error("SMTP user belum dikonfigurasi");
  if (!smtpPass) throw new Error("SMTP password belum dikonfigurasi");

  const fromValidation = validateEmail(fromEmail);
  if (!fromValidation.valid) {
    throw new Error(`FROM_EMAIL tidak valid: ${fromValidation.error}`);
  }

  return { smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromEmail };
}

function parseSmtpPort(raw: string | undefined): number {
  const port = Number.parseInt(raw ?? "587", 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error("SMTP port tidak valid");
  }
  return port;
}

function createTransporter(config: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
}

function validateAttachments(
  attachments: SendEmailParams["attachments"],
): string | null {
  if (!attachments?.length) return null;

  let total = 0;
  for (const attachment of attachments) {
    const size = attachment.content?.length ?? 0;
    if (size > MAX_SINGLE_ATTACHMENT_BYTES) {
      return `Attachment ${attachment.filename} melebihi ${MAX_SINGLE_ATTACHMENT_BYTES / 1024 / 1024} MB`;
    }
    total += size;
  }

  if (total > MAX_ATTACHMENT_BYTES) {
    return `Total attachment melebihi ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`;
  }
  return null;
}

function buildTestEmailPayload(testEmail: string): {
  subject: string;
  html: string;
} {
  return {
    subject: TEST_EMAIL_SUBJECT,
    html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #10b981;">Tes Konfigurasi Email</h2>
      <p>Ini adalah email percobaan untuk memverifikasi konfigurasi SMTP Anda.</p>
      <p style="margin-top: 20px; color: #10b981; font-weight: bold;">
        Jika Anda menerima email ini, konfigurasi Anda berfungsi dengan benar.
      </p>
      <p style="margin-top: 16px; font-size: 13px; color: #6b7280;">
        Dikirim ke ${testEmail}
      </p>
    </div>
  `,
  };
}
