import type {
  ResellerCommissionRuleEntity,
  ResellerCommissionRuleListItem,
  ResellerCommissionTypeValue,
} from "../domain/entities/ResellerCommissionEntity";
import type {
  CommissionRuleWindow,
  IResellerCommissionRuleRepository,
  UpdateCommissionRuleData,
} from "../domain/ports/IResellerCommissionRuleRepository";
import {
  ResellerConflictError,
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { startOfWibDay } from "../domain/wib-day";
import { ResellerCommissionRuleRepository } from "../repositories/ResellerCommissionRuleRepository";
import type {
  CreateResellerCommissionRuleInput,
  UpdateResellerCommissionRuleInput,
} from "../validators/reseller-commission-rule";

const RULE_NOT_FOUND_MESSAGE = "Aturan komisi tidak ditemukan";
const OVERLAP_MESSAGE =
  "Sudah ada aturan komisi aktif untuk paket yang sama pada rentang tanggal itu; akhiri atau nonaktifkan aturan lama dulu";

interface RuleValue {
  readonly type: ResellerCommissionTypeValue;
  readonly rate: number | null;
  readonly fixedAmount: number | null;
}

/**
 * Kelola aturan komisi reseller. Akrual memakai aturan ACTIVE yang berlaku
 * pada tanggal lunas (aturan per paket didahulukan), jadi aturan ACTIVE untuk
 * reseller+paket yang sama tidak boleh beririsan rentangnya: akrual akan
 * memilih salah satunya secara diam-diam. Aturan tidak pernah dihapus karena
 * komisi lama merujuknya; menonaktifkan menghentikannya untuk akrual baru.
 */
export class ResellerCommissionRuleService {
  constructor(
    private readonly repository: IResellerCommissionRuleRepository = new ResellerCommissionRuleRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Daftar aturan komisi reseller. */
  async listRules(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ResellerCommissionRuleListItem[]> {
    await this.assertResellerExists(tenantId, resellerId);
    return this.repository.listByReseller(tenantId, resellerId);
  }

  /**
   * Buat aturan komisi ACTIVE. Tanpa `startsAt`, aturan berlaku sejak awal
   * hari ini (WIB), supaya invoice yang lunas lebih awal hari ini tetapi
   * diproses sesudah aturan dibuat tetap mendapat aturan.
   *
   * @throws ResellerNotFoundError reseller tidak ada di tenant.
   * @throws ResellerValidationError paket bukan milik tenant.
   * @throws ResellerConflictError bentrok dengan aturan aktif lain.
   */
  async createRule(
    tenantId: string,
    resellerId: string,
    input: CreateResellerCommissionRuleInput,
  ): Promise<ResellerCommissionRuleEntity> {
    await this.assertResellerExists(tenantId, resellerId);
    if (
      input.hargaPaketId &&
      !(await this.repository.packageExists(tenantId, input.hargaPaketId))
    ) {
      throw new ResellerValidationError("Paket tidak ditemukan");
    }
    const startsAt = input.startsAt ?? startOfWibDay(this.now());
    const endsAt = input.endsAt ?? null;
    const scope = { tenantId, resellerId, hargaPaketId: input.hargaPaketId };
    return this.repository.runExclusive(scope, async (repository) => {
      await assertNoOverlap(repository, { ...scope, startsAt, endsAt });
      return repository.create({
        ...scope,
        ...toRuleValue(input),
        startsAt,
        endsAt,
      });
    });
  }

  /**
   * Ubah nilai, rentang, atau status aturan. Mengaktifkan ulang atau
   * menggeser rentang diperiksa bentroknya seperti aturan baru.
   */
  async updateRule(
    tenantId: string,
    resellerId: string,
    ruleId: string,
    input: UpdateResellerCommissionRuleInput,
  ): Promise<ResellerCommissionRuleEntity> {
    const current = await this.findRuleOrThrow(tenantId, resellerId, ruleId);
    const data = buildUpdateData(current, input);
    const next = { ...current, ...data };
    if (next.endsAt && next.startsAt.getTime() > next.endsAt.getTime()) {
      throw new ResellerValidationError(
        "Tanggal berakhir tidak boleh sebelum tanggal mulai",
      );
    }
    if (next.status !== "ACTIVE") return this.repository.update(ruleId, data);
    const scope = {
      tenantId,
      resellerId,
      hargaPaketId: current.hargaPaketId,
    };
    return this.repository.runExclusive(scope, async (repository) => {
      await assertNoOverlap(repository, {
        ...scope,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        excludeRuleId: ruleId,
      });
      return repository.update(ruleId, data);
    });
  }

  /** Nonaktifkan aturan (idempoten); komisi lama yang merujuknya tetap utuh. */
  async deactivateRule(
    tenantId: string,
    resellerId: string,
    ruleId: string,
  ): Promise<ResellerCommissionRuleEntity> {
    const current = await this.findRuleOrThrow(tenantId, resellerId, ruleId);
    if (current.status === "INACTIVE") return current;
    return this.repository.update(ruleId, { status: "INACTIVE" });
  }

  private async findRuleOrThrow(
    tenantId: string,
    resellerId: string,
    ruleId: string,
  ): Promise<ResellerCommissionRuleEntity> {
    const rule = await this.repository.findById(tenantId, resellerId, ruleId);
    if (!rule) throw new ResellerNotFoundError(RULE_NOT_FOUND_MESSAGE);
    return rule;
  }

  private async assertResellerExists(
    tenantId: string,
    resellerId: string,
  ): Promise<void> {
    if (!(await this.repository.resellerExists(tenantId, resellerId))) {
      throw new ResellerNotFoundError();
    }
  }
}

async function assertNoOverlap(
  repository: IResellerCommissionRuleRepository,
  window: CommissionRuleWindow,
): Promise<void> {
  if (await repository.findOverlappingActiveRule(window)) {
    throw new ResellerConflictError(OVERLAP_MESSAGE);
  }
}

/** Nilai komisi sesuai jenisnya; kolom jenis lain dikosongkan. */
function toRuleValue(input: {
  readonly type: ResellerCommissionTypeValue;
  readonly rate?: number | null;
  readonly fixedAmount?: number | null;
}): RuleValue {
  return input.type === "PERCENTAGE"
    ? { type: "PERCENTAGE", rate: input.rate ?? null, fixedAmount: null }
    : { type: "FIXED", rate: null, fixedAmount: input.fixedAmount ?? null };
}

/**
 * Data ubahan. Nilai tanpa `type` mengikuti jenis aturan sekarang; nilai yang
 * tidak cocok dengan jenisnya ditolak, supaya aturan tidak pernah punya persen
 * dan nominal sekaligus.
 */
function buildUpdateData(
  current: ResellerCommissionRuleEntity,
  input: UpdateResellerCommissionRuleInput,
): UpdateCommissionRuleData {
  const type = input.type ?? current.type;
  const hasValue = input.rate !== undefined || input.fixedAmount !== undefined;
  if (hasValue || input.type) {
    const value = type === "PERCENTAGE" ? input.rate : input.fixedAmount;
    if (value === undefined) {
      throw new ResellerValidationError(
        type === "PERCENTAGE"
          ? "Aturan persen hanya menerima persen komisi"
          : "Aturan nominal hanya menerima nominal komisi",
      );
    }
  }
  return {
    ...(hasValue || input.type
      ? toRuleValue({
          type,
          rate: input.rate ?? null,
          fixedAmount: input.fixedAmount ?? null,
        })
      : {}),
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
}

let resellerCommissionRuleService: ResellerCommissionRuleService | null = null;

/** Get singleton reseller commission rule service. */
export function getResellerCommissionRuleService(): ResellerCommissionRuleService {
  if (!resellerCommissionRuleService) {
    resellerCommissionRuleService = new ResellerCommissionRuleService();
  }
  return resellerCommissionRuleService;
}
