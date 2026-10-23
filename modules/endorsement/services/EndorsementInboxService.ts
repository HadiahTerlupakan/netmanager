import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "../domain/entities/Endorsement";
import type {
  IEndorsementRepository,
  SignerInboxScope,
} from "../domain/ports/IEndorsementRepository";
import {
  toInboxDetail,
  toInboxItem,
  type InboxDetailDto,
  type InboxItemDto,
} from "../dto/endorsement-inbox.dto";
import { EndorsementRepository } from "../repositories/EndorsementRepository";
import {
  EndorsementService,
  type SignerRequestContext,
} from "./EndorsementService";

/**
 * Kotak masuk penanda tangan internal (karyawan yang dipilih langsung saat
 * surat dibuat). Mereka menandatangani lewat aplikasi dengan sesi login,
 * bukan lewat token tautan — hak aksesnya adalah "ditunjuk di surat ini".
 */

export interface InboxQuery {
  userId: string;
  scope: SignerInboxScope;
  page: number;
  limit: number;
}

export class EndorsementInboxService {
  constructor(
    private readonly repository: IEndorsementRepository = new EndorsementRepository(),
    private readonly endorsements: EndorsementService = new EndorsementService(repository),
  ) {}

  /** Jumlah surat yang menunggu tanda tangan user, dan seluruh surat untuknya. */
  summary(userId: string) {
    return this.repository.countForSignerUser(userId, new Date());
  }

  /** Daftar surat untuk user pada satu cakupan (menunggu / selesai). */
  async list(
    query: InboxQuery,
  ): Promise<{ items: InboxItemDto[]; total: number }> {
    const result = await this.repository.findManyForSignerUser({
      ...query,
      now: new Date(),
    });

    return {
      items: result.items.map((endorsement) =>
        toInboxItem(endorsement, this.findMe(endorsement, query.userId)),
      ),
      total: result.total,
    };
  }

  /** Detail surat; membukanya sekaligus mencatat surat sudah dilihat. */
  async detail(
    endorsementId: string,
    userId: string,
    context: SignerRequestContext,
  ): Promise<InboxDetailDto> {
    const resolved = await this.endorsements.resolveForUser(endorsementId, userId);
    await this.endorsements.markSignerViewed(resolved, context);
    // Dimuat ulang supaya status "sudah dibuka" yang baru tercatat ikut tampil.
    const { endorsement, signer } = await this.endorsements.resolveForUser(
      endorsementId,
      userId,
    );

    return toInboxDetail(endorsement, signer);
  }

  /** Berkas PDF surat untuk penanda tangannya. */
  async document(endorsementId: string, userId: string) {
    const { endorsement } = await this.endorsements.resolveForUser(
      endorsementId,
      userId,
    );

    return this.endorsements.readDocumentFor(endorsement);
  }

  /** Bubuhkan tanda tangan user pada surat yang menunjuknya. */
  async sign(
    endorsementId: string,
    userId: string,
    signature: { buffer: Buffer; context: SignerRequestContext },
  ): Promise<{ completed: boolean }> {
    const resolved = await this.endorsements.resolveForUser(endorsementId, userId);
    const { completed } = await this.endorsements.signAs(
      resolved,
      signature.buffer,
      signature.context,
    );

    return { completed };
  }

  /** Tolak mengesahkan surat yang menunjuk user. */
  async decline(
    endorsementId: string,
    userId: string,
    decision: { reason: string; context: SignerRequestContext },
  ): Promise<void> {
    const resolved = await this.endorsements.resolveForUser(endorsementId, userId);
    await this.endorsements.declineAs(resolved, decision.reason, decision.context);
  }

  /** Repository hanya mengembalikan surat yang memuat user ini sebagai penanda tangan. */
  private findMe(
    endorsement: EndorsementEntity,
    userId: string,
  ): EndorsementSignerEntity {
    return endorsement.signers.find((signer) => signer.userId === userId)!;
  }
}
