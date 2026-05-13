import { logger } from "@/lib/logger";
import { resolveCustomerContact, type CustomerContact } from "./channel-router";
import {
  BILLING_TEMPLATES,
  type BillingTemplate,
  type BillingTemplateKey,
  type BillingTemplateParams,
} from "../templates/billing-templates";
import { createNotification } from "./NotificationService";
import { sendCustomerPushNotification } from "./ExpoPushService";
import { WhatsAppService } from "./whatsapp/whatsapp-service";
import { EmailService } from "./email-service";

export type NotificationChannel = "inApp" | "push" | "whatsapp" | "email";

export interface NotificationDispatchInput {
  pelangganId: string;
  templateKey: BillingTemplateKey;
  params: BillingTemplateParams;
  sourceType: string;
  sourceId: string;
  /** Opsional: batasi channel yang digunakan. Default: semua 4 channel. */
  channels?: NotificationChannel[];
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  "inApp",
  "push",
  "whatsapp",
  "email",
];

/**
 * Orchestrator pengiriman notifikasi ke multi-channel (In-App, Push, WhatsApp, Email).
 *
 * Behavior:
 * - Enforce user preference `Pelanggan.isBillNotifEnabled` — skip semua channel jika false
 * - Resolve kontak per channel — skip channel jika kontak tidak tersedia
 * - Best-effort delivery — channel fail tidak mencegah channel lain dispatch
 * - Enrich params.customerName dari DB jika tidak di-pass
 */
export class NotificationDispatcher {
  /** Dispatch notifikasi ke semua channel yang relevan untuk satu pelanggan. */
  async dispatch(input: NotificationDispatchInput): Promise<void> {
    const contact = await resolveCustomerContact(input.pelangganId);
    if (!contact) {
      logger.warn(
        `[NotificationDispatcher] Pelanggan tidak ditemukan: ${input.pelangganId}`,
      );
      return;
    }

    if (!contact.isBillNotifEnabled) {
      logger.info(
        `[NotificationDispatcher] Skip — ${input.pelangganId} menonaktifkan notifikasi tagihan`,
      );
      return;
    }

    const template = BILLING_TEMPLATES[input.templateKey];
    const enrichedParams: BillingTemplateParams = {
      ...input.params,
      customerName: input.params.customerName || contact.customerName,
    };
    const channels = input.channels ?? DEFAULT_CHANNELS;

    await Promise.allSettled(
      channels.map((channel) =>
        this.sendChannel(channel, contact, template, enrichedParams, input),
      ),
    );
  }

  private async sendChannel(
    channel: NotificationChannel,
    contact: CustomerContact,
    template: BillingTemplate,
    params: BillingTemplateParams,
    input: NotificationDispatchInput,
  ): Promise<void> {
    try {
      switch (channel) {
        case "inApp":
          await this.sendInApp(contact, template, params, input);
          return;
        case "push":
          await this.sendPush(contact, template, params, input);
          return;
        case "whatsapp":
          await this.sendWhatsApp(contact, template, params);
          return;
        case "email":
          await this.sendEmail(contact, template, params);
          return;
      }
    } catch (error) {
      logger.error(
        `[NotificationDispatcher] Channel ${channel} gagal untuk pelanggan ${input.pelangganId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async sendInApp(
    contact: CustomerContact,
    template: BillingTemplate,
    params: BillingTemplateParams,
    input: NotificationDispatchInput,
  ): Promise<void> {
    if (!contact.userId) return;
    await createNotification({
      type: "SYSTEM",
      userId: contact.userId,
      title: template.title,
      message: template.inApp(params),
      link: "/tagihan",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      priority: "HIGH",
      tenantId: contact.tenantId ?? undefined,
    });
  }

  private async sendPush(
    contact: CustomerContact,
    template: BillingTemplate,
    params: BillingTemplateParams,
    input: NotificationDispatchInput,
  ): Promise<void> {
    await sendCustomerPushNotification(
      contact.customerId,
      template.title,
      template.push(params),
      { sourceType: input.sourceType, sourceId: input.sourceId },
    );
  }

  private async sendWhatsApp(
    contact: CustomerContact,
    template: BillingTemplate,
    params: BillingTemplateParams,
  ): Promise<void> {
    if (!contact.noTelp) return;
    // WhatsAppService.sendMessage pakai { phone, message } — bukan { to, message }
    await new WhatsAppService().sendMessage({
      phone: contact.noTelp,
      message: template.whatsapp(params),
    });
  }

  private async sendEmail(
    contact: CustomerContact,
    template: BillingTemplate,
    params: BillingTemplateParams,
  ): Promise<void> {
    if (!contact.email) return;
    const emailContent = template.email(params);
    // EmailService.sendEmail pakai { to, subject, html } — bukan send({ text })
    await new EmailService().sendEmail({
      to: contact.email,
      subject: emailContent.subject,
      html: emailContent.body,
    });
  }
}
