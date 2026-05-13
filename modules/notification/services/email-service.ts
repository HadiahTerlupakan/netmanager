import { logger } from "@/lib/logger";
// Email Service using Nodemailer
import nodemailer from "nodemailer";
import { AttendanceSettingsService } from "@/modules/attendance";
import { decryptApiKey } from "@/lib/utils/encryption";
import { EmailDeliveryLogRepository } from "../repositories/EmailDeliveryLogRepository";

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
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private settingsRepo?: AttendanceSettingsService;
  private readonly logRepo = new EmailDeliveryLogRepository();

  constructor(settingsRepo?: AttendanceSettingsService) {
    this.settingsRepo = settingsRepo;
  }

  private getSettingsRepo(): AttendanceSettingsService {
    if (!this.settingsRepo) {
      this.settingsRepo = new AttendanceSettingsService();
    }

    return this.settingsRepo;
  }

  /**
   * Load email configuration from database
   */
  private async loadConfig(): Promise<EmailConfig> {
    const settings = await this.getSettingsRepo().findManyByKeys([
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "FROM_NAME",
      "FROM_EMAIL",
    ]);

    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value || "";
    }

    // Decrypt password
    const encryptedPass = settingsMap["SMTP_PASS"];
    if (!encryptedPass) {
      throw new Error("Password SMTP belum dikonfigurasi");
    }

    const smtpPass = decryptApiKey(encryptedPass);

    return {
      smtpHost: settingsMap["SMTP_HOST"] || "",
      smtpPort: parseInt(settingsMap["SMTP_PORT"] || "587"),
      smtpUser: settingsMap["SMTP_USER"] || "",
      smtpPass,
      fromName: settingsMap["FROM_NAME"] || "NetManager ISP",
      fromEmail: settingsMap["FROM_EMAIL"] || settingsMap["SMTP_USER"],
    };
  }

  /**
   * Send email dengan delivery logging ke EmailDeliveryLog.
   * Log PENDING dibuat sebelum kirim, diupdate ke SENT/FAILED setelah selesai.
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const logId = await this.logRepo.logAttempt({
      to: params.to,
      subject: params.subject,
    });

    try {
      const config = await this.loadConfig();
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      // Send email
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      });

      await this.logRepo.markSent(logId, info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("[Email] Error:", error);
      await this.logRepo.markFailed(logId, errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Test email connection
   */
  async testConnection(testEmail: string): Promise<SendEmailResult> {
    return this.sendEmail({
      to: testEmail,
      subject: "Email Percobaan dari NetManager",
      html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #10b981;">✅ Tes Konfigurasi Email</h2>
                    <p>Ini adalah email percobaan untuk memverifikasi konfigurasi email Anda.</p>
                    <p style="margin-top: 20px; color: #10b981; font-weight: bold;">
                        Jika Anda menerima email ini, konfigurasi Anda berfungsi dengan benar!
                    </p>
                </div>
            `,
    });
  }
}
