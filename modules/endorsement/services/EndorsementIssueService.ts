import type { EndorsementEntity } from "../domain/entities/Endorsement";
import {
  buildSignerUrl,
  EndorsementNotificationService,
  type DeliveryOutcome,
} from "./EndorsementNotificationService";
import {
  EndorsementService,
  type CreateEndorsementCommand,
  type SignerLink,
} from "./EndorsementService";

/**
 * Penerbitan tautan tanda tangan: membuat surat atau tautan baru, lalu
 * langsung mengirimkannya.
 *
 * Keduanya harus terjadi dalam satu alur karena token hanya ada di memori
 * pada momen ini — tidak pernah tersimpan mentah — sehingga tidak ada
 * kesempatan kedua untuk mengirimkannya.
 */

export interface IssuedLink {
  signerId: string;
  name: string;
  url: string;
}

export interface IssueResult {
  endorsement: EndorsementEntity;
  deliveries: DeliveryOutcome[];
  /** URL hanya dikembalikan di sini supaya admin bisa meneruskannya manual. */
  links: IssuedLink[];
}

function toIssuedLink(link: SignerLink): IssuedLink {
  return {
    signerId: link.signerId,
    name: link.name,
    url: buildSignerUrl(link.token),
  };
}

export class EndorsementIssueService {
  constructor(
    private readonly endorsements: EndorsementService = new EndorsementService(),
    private readonly notifications: EndorsementNotificationService = new EndorsementNotificationService(),
  ) {}

  /** Buat surat, kirim tautan ke semua penanda tangan, lalu tandai terkirim. */
  async issue(
    command: CreateEndorsementCommand,
    createdById: string,
  ): Promise<IssueResult> {
    const { endorsement, links } = await this.endorsements.create(
      command,
      createdById,
    );

    const deliveries = await this.notifications.sendInvitations({
      endorsementTitle: endorsement.title,
      tenantId: endorsement.tenantId,
      links,
    });

    await this.endorsements.markSent(endorsement.id);

    return { endorsement, deliveries, links: links.map(toIssuedLink) };
  }

  /** Terbitkan ulang tautan satu penanda tangan dan kirimkan lagi. */
  async reissue(
    endorsementId: string,
    signerId: string,
  ): Promise<{ delivery: DeliveryOutcome; link: IssuedLink }> {
    const endorsement = await this.endorsements.getById(endorsementId);
    const link = await this.endorsements.reissueSignerLink(
      endorsementId,
      signerId,
    );

    const [delivery] = await this.notifications.sendInvitations({
      endorsementTitle: endorsement.title,
      tenantId: endorsement.tenantId,
      links: [link],
    });

    return { delivery: delivery!, link: toIssuedLink(link) };
  }
}
