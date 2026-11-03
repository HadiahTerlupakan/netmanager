import type {
  ResellerEntity,
  ResellerStatusValue,
} from "../domain/entities/ResellerEntity";
import type { IResellerComplianceSettings } from "../domain/ports/IResellerComplianceSettings";
import type { IResellerPksDirectory } from "../domain/ports/IResellerPksDirectory";
import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import {
  COMPLIANCE_ISSUE_LABELS,
  evaluateCompliance,
  type ResellerComplianceResult,
  summarizePks,
} from "../domain/reseller-compliance";
import type {
  ResellerComplianceSettingDTO,
  ResellerWithComplianceDTO,
} from "../dto/reseller.dto";
import { ResellerValidationError } from "../errors/reseller-errors";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";
import { LegalResellerPksDirectory } from "./legal-pks-directory";
import { TenantResellerComplianceSettings } from "./reseller-compliance-settings";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Kepatuhan regulasi reseller: data izin (NIB, KBLI, Sertifikat Standar) dan
 * PKS aktif di modul legal, serta pengaturan tenant yang mewajibkannya
 * sebelum reseller menerima pelanggan baru.
 */
export class ResellerComplianceService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
    private readonly pksDirectory: IResellerPksDirectory = new LegalResellerPksDirectory(),
    private readonly settings: IResellerComplianceSettings = new TenantResellerComplianceSettings(),
  ) {}

  /** Daftar reseller tenant beserta status PKS dan kepatuhannya. */
  async listResellersWithCompliance(params: {
    readonly tenantId: string;
    readonly page?: number;
    readonly limit?: number;
    readonly search?: string;
    readonly status?: ResellerStatusValue;
  }): Promise<{
    readonly items: readonly ResellerWithComplianceDTO[];
    readonly total: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    const result = await this.repository.findAll({
      tenantId: params.tenantId,
      search: params.search,
      status: params.status,
      skip: (page - 1) * limit,
      take: limit,
    });
    const evaluations = await this.evaluateMany(params.tenantId, result.items);
    return {
      items: result.items.map((reseller) =>
        ResellerMapper.toWithComplianceDTO(
          reseller,
          evaluationFor(evaluations, reseller),
        ),
      ),
      total: result.total,
    };
  }

  /** Detail reseller beserta kepatuhannya; null bila tidak ada di tenant. */
  async getResellerWithCompliance(
    tenantId: string,
    id: string,
  ): Promise<ResellerWithComplianceDTO | null> {
    const reseller = await this.repository.findById(tenantId, id);
    if (!reseller) return null;
    return ResellerMapper.toWithComplianceDTO(
      reseller,
      await this.evaluateOne(tenantId, reseller),
    );
  }

  /**
   * Tolak penugasan pelanggan BARU ke reseller yang belum patuh bila tenant
   * menyalakan "wajibkan kepatuhan reseller". Tidak berlaku tanpa tenant.
   *
   * @throws ResellerValidationError reseller belum patuh dan pengaturan aktif.
   */
  async assertCanAcceptNewCustomer(
    tenantId: string | null,
    reseller: ResellerEntity,
  ): Promise<void> {
    if (!tenantId) return;
    if (!(await this.settings.isComplianceRequired(tenantId))) return;

    const result = await this.evaluateOne(tenantId, reseller);
    if (result.isCompliant) return;

    const reasons = result.issues
      .map((issue) => COMPLIANCE_ISSUE_LABELS[issue])
      .join("; ");
    throw new ResellerValidationError(
      `Reseller ${reseller.name} belum memenuhi kepatuhan regulasi (${reasons}). ` +
        "Lengkapi data izin dan PKS reseller, atau matikan pengaturan " +
        '"Wajibkan kepatuhan reseller".',
    );
  }

  /** Pengaturan tata kelola reseller tenant (semua default mati). */
  async getComplianceSetting(
    tenantId: string,
  ): Promise<ResellerComplianceSettingDTO> {
    const [isComplianceRequired, isSettlementSeparateApproverRequired] =
      await Promise.all([
        this.settings.isComplianceRequired(tenantId),
        this.settings.isSettlementSeparateApproverRequired(tenantId),
      ]);
    return { isComplianceRequired, isSettlementSeparateApproverRequired };
  }

  /**
   * Simpan sakelar tata kelola yang dikirim saja; sakelar yang tidak dikirim
   * dibiarkan. Mengembalikan keadaan lengkap setelah disimpan.
   */
  async updateComplianceSetting(
    tenantId: string,
    patch: Partial<ResellerComplianceSettingDTO>,
  ): Promise<ResellerComplianceSettingDTO> {
    const writes: Promise<void>[] = [];
    if (patch.isComplianceRequired !== undefined) {
      writes.push(
        this.settings.setComplianceRequired(
          tenantId,
          patch.isComplianceRequired,
        ),
      );
    }
    if (patch.isSettlementSeparateApproverRequired !== undefined) {
      writes.push(
        this.settings.setSettlementSeparateApproverRequired(
          tenantId,
          patch.isSettlementSeparateApproverRequired,
        ),
      );
    }
    await Promise.all(writes);
    return this.getComplianceSetting(tenantId);
  }

  private async evaluateOne(
    tenantId: string,
    reseller: ResellerEntity,
  ): Promise<ResellerComplianceResult> {
    const evaluations = await this.evaluateMany(tenantId, [reseller]);
    return evaluationFor(evaluations, reseller);
  }

  private async evaluateMany(
    tenantId: string,
    resellers: readonly ResellerEntity[],
  ): Promise<ReadonlyMap<string, ResellerComplianceResult>> {
    const contracts = await this.pksDirectory.listContractsByReseller(
      tenantId,
      resellers.map((reseller) => reseller.id),
    );
    return new Map(
      resellers.map((reseller) => [
        reseller.id,
        evaluateCompliance(
          reseller,
          summarizePks(contracts.get(reseller.id) ?? []),
        ),
      ]),
    );
  }
}

/** Hasil evaluasi reseller; reseller tanpa entri dinilai tanpa PKS. */
function evaluationFor(
  evaluations: ReadonlyMap<string, ResellerComplianceResult>,
  reseller: ResellerEntity,
): ResellerComplianceResult {
  return (
    evaluations.get(reseller.id) ??
    evaluateCompliance(reseller, summarizePks([]))
  );
}

let resellerComplianceService: ResellerComplianceService | null = null;

/** Get singleton reseller compliance service. */
export function getResellerComplianceService(): ResellerComplianceService {
  if (!resellerComplianceService) {
    resellerComplianceService = new ResellerComplianceService();
  }
  return resellerComplianceService;
}
