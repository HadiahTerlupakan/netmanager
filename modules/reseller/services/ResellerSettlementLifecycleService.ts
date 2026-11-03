import type { ResellerSettlementEntity } from "../domain/entities/ResellerCommissionEntity";
import type { IResellerAccountingEvents } from "../domain/ports/IResellerAccountingEvents";
import type { IResellerComplianceSettings } from "../domain/ports/IResellerComplianceSettings";
import type {
  IResellerSettlementRepository,
  SettlementPaymentAccount,
} from "../domain/ports/IResellerSettlementRepository";
import {
  ResellerConflictError,
  ResellerForbiddenError,
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { ResellerSettlementRepository } from "../repositories/ResellerSettlementRepository";
import { EventBusResellerAccountingEvents } from "./event-bus-accounting-events";
import { TenantResellerComplianceSettings } from "./reseller-compliance-settings";

const SETTLEMENT_NOT_FOUND_MESSAGE = "Settlement reseller tidak ditemukan";
const INSUFFICIENT_BALANCE_MESSAGE =
  "Saldo rekening tidak mencukupi untuk membayar settlement ini";
const SAME_APPROVER_PAYER_MESSAGE =
  "Pemisahan tugas aktif: settlement harus dibayar oleh pengguna lain, " +
  "bukan pengguna yang menyetujuinya";
const SAME_CREATOR_APPROVER_MESSAGE =
  "Pemisahan tugas aktif: settlement harus disetujui oleh pengguna lain, " +
  "bukan pengguna yang membuatnya";
/** Toleransi jam server vs jam klien untuk tanggal bayar "hari ini". */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

interface SettlementRef {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly settlementId: string;
  readonly actorId: string | null;
}

interface PaySettlementInput extends SettlementRef {
  readonly paidAt: Date;
  readonly paymentMethod: string;
  readonly paymentReference: string | null;
  readonly accountId: string;
}

/**
 * Siklus settlement komisi: PENDING → APPROVED → PAID.
 *
 * Transisi idempoten: mengulang transisi yang sudah tercapai mengembalikan
 * settlement apa adanya, bukan galat. Melompat atau mundur (bayar sebelum
 * disetujui, setujui yang sudah dibayar) ditolak 409. Pembayaran dikabarkan
 * ke accounting (Dr Utang Komisi / Cr Kas/Bank); ulangan bayar mengirim ulang
 * event yang sama, dan jurnalnya idempoten per settlement.
 *
 * Bila tenant menyalakan RESELLER_SETTLEMENT_SEPARATE_APPROVER, pengguna yang
 * membuat settlement tidak boleh menyetujuinya, dan pengguna yang
 * menyetujuinya tidak boleh menandainya dibayar (403).
 */
export class ResellerSettlementLifecycleService {
  constructor(
    private readonly repository: IResellerSettlementRepository = new ResellerSettlementRepository(),
    private readonly accountingEvents: IResellerAccountingEvents = new EventBusResellerAccountingEvents(),
    private readonly now: () => Date = () => new Date(),
    private readonly settings: Pick<
      IResellerComplianceSettings,
      "isSettlementSeparateApproverRequired"
    > = new TenantResellerComplianceSettings(),
  ) {}

  /**
   * Setujui settlement PENDING.
   *
   * @throws ResellerNotFoundError settlement tidak ada di reseller/tenant.
   * @throws ResellerConflictError settlement sudah dibayar.
   * @throws ResellerForbiddenError pemisahan tugas aktif dan penyetuju adalah
   *   pembuat settlement.
   */
  async approve(input: SettlementRef): Promise<ResellerSettlementEntity> {
    const current = await this.findOrThrow(input);
    if (current.status === "APPROVED") return current;
    assertNotPaid(current, "disetujui");
    await this.assertSeparateActors(
      current.createdById,
      input,
      SAME_CREATOR_APPROVER_MESSAGE,
    );

    const approved = await this.repository.approve({
      settlementId: current.id,
      approvedAt: this.now(),
      approvedById: input.actorId,
    });
    if (approved) return approved;
    return this.resolveLostRace(input, "APPROVED");
  }

  /**
   * Tandai settlement APPROVED sebagai dibayar dari rekening Kas & Bank.
   *
   * @throws ResellerNotFoundError settlement tidak ada di reseller/tenant.
   * @throws ResellerValidationError rekening bukan milik tenant/nonaktif,
   *   saldonya kurang dari total settlement, atau tanggal bayar di masa depan.
   * @throws ResellerConflictError settlement belum disetujui.
   * @throws ResellerForbiddenError pemisahan tugas aktif dan pembayar adalah
   *   penyetuju settlement.
   */
  async markPaid(input: PaySettlementInput): Promise<ResellerSettlementEntity> {
    const current = await this.findOrThrow(input);
    if (current.status === "PAID") {
      await this.accountingEvents.settlementPaid(current);
      return current;
    }
    if (current.status !== "APPROVED") {
      throw new ResellerConflictError(
        "Settlement harus disetujui sebelum ditandai dibayar",
      );
    }
    await this.assertSeparateActors(
      current.approvedById,
      input,
      SAME_APPROVER_PAYER_MESSAGE,
    );
    await this.assertPaymentValid(input);

    const outcome = await this.repository.markPaid({
      tenantId: input.tenantId,
      settlementId: current.id,
      paidAt: input.paidAt,
      paidById: input.actorId,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      paymentAccountId: input.accountId,
    });
    if (outcome.kind === "insufficient-balance") {
      throw new ResellerValidationError(INSUFFICIENT_BALANCE_MESSAGE);
    }
    const settlement =
      outcome.kind === "paid"
        ? outcome.settlement
        : await this.resolveLostRace(input, "PAID");
    await this.accountingEvents.settlementPaid(settlement);
    return settlement;
  }

  /**
   * Rekening Kas & Bank aktif tenant untuk form bayar. Disajikan lewat izin
   * keuangan reseller (bukan izin baca kas), supaya siapa pun yang boleh
   * membayar settlement juga bisa memilih rekeningnya.
   */
  async listPaymentAccounts(
    tenantId: string,
  ): Promise<readonly SettlementPaymentAccount[]> {
    return this.repository.listPaymentAccounts(tenantId);
  }

  /**
   * Pemisahan tugas: tolak bila pelaku sekarang sama dengan pelaku tahap
   * sebelumnya (pembuat → penyetuju, penyetuju → pembayar) dan tenant
   * mewajibkannya. Pelaku yang tidak tercatat (null) tidak dibandingkan.
   */
  private async assertSeparateActors(
    previousActorId: string | null,
    input: {
      readonly tenantId: string | null;
      readonly actorId?: string | null;
    },
    message: string,
  ): Promise<void> {
    if (!input.tenantId || !input.actorId) return;
    if (previousActorId !== input.actorId) return;
    const isSeparationRequired =
      await this.settings.isSettlementSeparateApproverRequired(input.tenantId);
    if (!isSeparationRequired) return;
    throw new ResellerForbiddenError(message);
  }

  private async assertPaymentValid(input: PaySettlementInput): Promise<void> {
    if (input.paidAt.getTime() > this.now().getTime() + FUTURE_TOLERANCE_MS) {
      throw new ResellerValidationError(
        "Tanggal bayar tidak boleh di masa depan",
      );
    }
    if (
      !(await this.repository.paymentAccountExists(
        input.tenantId,
        input.accountId,
      ))
    ) {
      throw new ResellerValidationError(
        "Rekening pembayaran tidak ditemukan atau nonaktif",
      );
    }
  }

  private async findOrThrow(
    input: SettlementRef,
  ): Promise<ResellerSettlementEntity> {
    const settlement = await this.repository.findById(
      input.tenantId,
      input.resellerId,
      input.settlementId,
    );
    if (!settlement) {
      throw new ResellerNotFoundError(SETTLEMENT_NOT_FOUND_MESSAGE);
    }
    return settlement;
  }

  /**
   * Transisi bersyarat gagal karena permintaan lain lebih dulu mengubah
   * status. Bila hasilnya sama dengan tujuan kita, itu ulangan yang sah.
   */
  private async resolveLostRace(
    input: SettlementRef,
    target: ResellerSettlementEntity["status"],
  ): Promise<ResellerSettlementEntity> {
    const latest = await this.findOrThrow(input);
    if (latest.status === target) return latest;
    throw new ResellerConflictError(
      "Status settlement berubah oleh permintaan lain; muat ulang data",
    );
  }
}

function assertNotPaid(
  settlement: ResellerSettlementEntity,
  action: string,
): void {
  if (settlement.status !== "PAID") return;
  throw new ResellerConflictError(
    `Settlement sudah dibayar sehingga tidak bisa ${action} lagi`,
  );
}

let resellerSettlementLifecycleService: ResellerSettlementLifecycleService | null =
  null;

/** Get singleton reseller settlement lifecycle service. */
export function getResellerSettlementLifecycleService(): ResellerSettlementLifecycleService {
  if (!resellerSettlementLifecycleService) {
    resellerSettlementLifecycleService =
      new ResellerSettlementLifecycleService();
  }
  return resellerSettlementLifecycleService;
}
