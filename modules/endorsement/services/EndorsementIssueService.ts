import { AppError } from "@/lib/errors";
import { UserLookupService } from "@/modules/users";
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

/** Direktori karyawan untuk memvalidasi penanda tangan internal pilihan admin. */
export interface SignerDirectory {
  filterActiveEmployeeIds(userIds: string[]): Promise<string[]>;
}

export class EndorsementIssueService {
  constructor(
    private readonly endorsements: EndorsementService = new EndorsementService(),
    private readonly notifications: EndorsementNotificationService = new EndorsementNotificationService(),
    private readonly directory: SignerDirectory = new UserLookupService(),
  ) {}

  /** Buat surat, kirim tautan ke semua penanda tangan, lalu tandai terkirim. */
  async issue(
    command: CreateEndorsementCommand,
    createdById: string,
  ): Promise<IssueResult> {
    await this.assertInternalSignersActive(command);
    const { endorsement, links } = await this.endorsements.create(
      command,
      createdById,
    );

    const deliveries = await this.notifications.sendInvitations({
      endorsementId: endorsement.id,
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
      endorsementId,
      endorsementTitle: endorsement.title,
      tenantId: endorsement.tenantId,
      links: [link],
    });

    return { delivery: delivery!, link: toIssuedLink(link) };
  }

  /**
   * Penanda tangan internal harus karyawan aktif di tenant ini. Id dari klien
   * tidak dipercaya begitu saja: id karyawan tenant lain atau yang sudah
   * nonaktif ditolak sebelum surat dibuat.
   */
  private async assertInternalSignersActive(
    command: CreateEndorsementCommand,
  ): Promise<void> {
    const requestedIds = command.signers
      .map((signer) => signer.userId)
      .filter((userId): userId is string => Boolean(userId));
    if (requestedIds.length === 0) return;

    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new AppError("Satu karyawan dipilih lebih dari sekali", 400, "VALIDATION_ERROR");
    }

    const activeIds = new Set(
      await this.directory.filterActiveEmployeeIds(requestedIds),
    );
    if (requestedIds.some((userId) => !activeIds.has(userId))) {
      throw new AppError("Ada penanda tangan internal yang tidak valid atau nonaktif", 400, "VALIDATION_ERROR");
    }
  }
}
