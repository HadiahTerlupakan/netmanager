import type { ResellerDTO } from "../dto/reseller.dto";
import type {
  CreateResellerData,
  IResellerRepository,
  UpdateResellerData,
} from "../domain/ports/IResellerRepository";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";

const DUPLICATE_CODE_MESSAGE = "Kode reseller sudah digunakan";
const RESELLER_NOT_FOUND_MESSAGE = "Reseller tidak ditemukan";

export class ResellerService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** Create reseller after ensuring code uniqueness in tenant scope. */
  async createReseller(data: CreateResellerData): Promise<ResellerDTO> {
    const normalized = this.normalizeCreateData(data);
    await this.ensureCodeIsUnique(normalized.tenantId, normalized.code);
    const reseller = await this.repository.create(normalized);
    return ResellerMapper.toDTO(reseller);
  }

  /** List resellers in tenant scope. */
  async listResellers(params: {
    readonly tenantId: string | null;
    readonly page?: number;
    readonly limit?: number;
  }): Promise<{
    readonly items: readonly ResellerDTO[];
    readonly total: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const result = await this.repository.findAll({
      tenantId: params.tenantId,
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: result.items.map((item) => ResellerMapper.toDTO(item)),
      total: result.total,
    };
  }

  /** Get reseller detail by tenant and id. */
  async getResellerById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerDTO | null> {
    const reseller = await this.repository.findById(tenantId, id);
    return reseller ? ResellerMapper.toDTO(reseller) : null;
  }

  /** Update reseller after validating existence and duplicate code. */
  async updateReseller(
    tenantId: string | null,
    id: string,
    data: UpdateResellerData,
  ): Promise<ResellerDTO> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new Error(RESELLER_NOT_FOUND_MESSAGE);
    }
    if (data.code && data.code !== existing.code) {
      await this.ensureCodeIsUnique(tenantId, data.code.trim());
    }
    const updated = await this.repository.update(tenantId, id, {
      ...data,
      code: data.code?.trim(),
      name: data.name?.trim(),
    });
    return ResellerMapper.toDTO(updated);
  }

  /** Soft-delete reseller by tenant and id. */
  async deleteReseller(tenantId: string | null, id: string): Promise<void> {
    await this.repository.softDelete(tenantId, id);
  }

  private normalizeCreateData(data: CreateResellerData): CreateResellerData {
    return {
      tenantId: data.tenantId,
      code: data.code.trim(),
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
    };
  }

  private async ensureCodeIsUnique(
    tenantId: string | null,
    code: string,
  ): Promise<void> {
    const existing = await this.repository.findByCode(tenantId, code);
    if (existing) {
      throw new Error(DUPLICATE_CODE_MESSAGE);
    }
  }
}

let resellerService: ResellerService | null = null;

/** Get singleton reseller service. */
export function getResellerService(): ResellerService {
  if (!resellerService) {
    resellerService = new ResellerService();
  }
  return resellerService;
}
