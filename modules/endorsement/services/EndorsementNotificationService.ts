import { logger } from "@/lib/logger";
import { getPublicSiteUrl } from "@/lib/utils/portal-url";
import { escapeHtml } from "@/lib/utils/sanitize";
import { EmailService, WhatsAppSenderService } from "@/modules/notification";
import type { SignerLink } from "./EndorsementService";

/**
 * Pengiriman tautan tanda tangan.
 *
 * Token hanya ada sekali di memori saat surat dibuat — tidak pernah tersimpan
 * mentah — sehingga pengiriman wajib terjadi pada momen itu juga. Kegagalan
 * satu penerima tidak menghentikan yang lain: yang gagal dilaporkan balik agar
 * pembuat surat bisa mengirim ulang.
 */

const LINK_PATH = "/p";

export interface DeliveryOutcome {
  signerId: string;
  channel: "whatsapp" | "email" | "none";
  delivered: boolean;
  error?: string;
}

export function buildSignerUrl(token: string): string {
  const base = getPublicSiteUrl();

  return `${base === "/" ? "" : base}${LINK_PATH}/${token}`;
}

function buildMessage(
  endorsementTitle: string,
  signerName: string,
  url: string,
): string {
  return [
    `Halo ${signerName},`,
    "",
    `Anda diminta mengesahkan dokumen: ${endorsementTitle}.`,
    "",
    `Buka tautan berikut untuk membaca dokumen dan membubuhkan tanda tangan:`,
    url,
    "",
    "Tautan ini bersifat rahasia dan hanya untuk Anda. Mohon tidak diteruskan ke pihak lain.",
  ].join("\n");
}

/**
 * Rangkai badan email.
 *
 * Judul surat dan nama penanda tangan diisi admin lewat formulir, sedangkan
 * penerimanya pihak luar — tanpa peng-escape-an, admin (atau siapa pun yang
 * menguasai akunnya) bisa menyisipkan markup ke dalam email orang lain. Semua
 * nilai yang disisipkan karena itu di-escape lebih dulu.
 */
function buildEmailHtml(
  endorsementTitle: string,
  signerName: string,
  url: string,
): string {
  return `
    <p>Halo ${escapeHtml(signerName)},</p>
    <p>Anda diminta mengesahkan dokumen: <strong>${escapeHtml(endorsementTitle)}</strong>.</p>
    <p><a href="${escapeHtml(url)}">Buka dokumen dan tanda tangani</a></p>
    <p style="color:#6b7280;font-size:12px">
      Tautan ini bersifat rahasia dan hanya untuk Anda. Mohon tidak diteruskan
      ke pihak lain.
    </p>
  `;
}

export class EndorsementNotificationService {
  /** Kirim tautan ke seluruh penanda tangan; laporkan hasil per orang. */
  async sendInvitations(input: {
    endorsementTitle: string;
    tenantId: string | null;
    links: SignerLink[];
  }): Promise<DeliveryOutcome[]> {
    const outcomes: DeliveryOutcome[] = [];

    for (const link of input.links) {
      outcomes.push(
        await this.sendOne(input.endorsementTitle, input.tenantId, link),
      );
    }

    return outcomes;
  }

  private async sendOne(
    endorsementTitle: string,
    tenantId: string | null,
    link: SignerLink,
  ): Promise<DeliveryOutcome> {
    const url = buildSignerUrl(link.token);

    if (link.phone) {
      return this.sendWhatsApp(endorsementTitle, tenantId, link, url);
    }

    if (link.email) {
      return this.sendEmail(endorsementTitle, tenantId, link, url);
    }

    // Penanda tangan internal tanpa kontak tetap bisa membuka tautan dari
    // halaman detail surat; bukan kegagalan, hanya tidak ada kanal keluar.
    return { signerId: link.signerId, channel: "none", delivered: false };
  }

  private async sendWhatsApp(
    endorsementTitle: string,
    tenantId: string | null,
    link: SignerLink,
    url: string,
  ): Promise<DeliveryOutcome> {
    try {
      const result = await new WhatsAppSenderService().send({
        phone: link.phone!,
        message: buildMessage(endorsementTitle, link.name, url),
        tenantId: tenantId ?? undefined,
        accountType: "CUSTOMER",
      });

      return {
        signerId: link.signerId,
        channel: "whatsapp",
        delivered: result.success,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      logger.error(
        "[Endorsement] Gagal mengirim tautan lewat WhatsApp:",
        error,
      );

      return {
        signerId: link.signerId,
        channel: "whatsapp",
        delivered: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async sendEmail(
    endorsementTitle: string,
    tenantId: string | null,
    link: SignerLink,
    url: string,
  ): Promise<DeliveryOutcome> {
    if (!tenantId) {
      return {
        signerId: link.signerId,
        channel: "email",
        delivered: false,
        error: "Tenant tidak diketahui",
      };
    }

    try {
      const result = await new EmailService().sendEmail({
        to: link.email!,
        subject: `Permintaan pengesahan: ${endorsementTitle}`,
        html: buildEmailHtml(endorsementTitle, link.name, url),
        text: buildMessage(endorsementTitle, link.name, url),
        tenantId,
      });

      return {
        signerId: link.signerId,
        channel: "email",
        delivered: result.success,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      logger.error("[Endorsement] Gagal mengirim tautan lewat email:", error);

      return {
        signerId: link.signerId,
        channel: "email",
        delivered: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
