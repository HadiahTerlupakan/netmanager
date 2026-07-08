import type { ResellerOutletDTO } from "../dto/reseller.dto";
import type {
  CreateOutletData,
  IResellerRepository,
  UpdateOutletData,
} from "../domain/ports/IResellerRepository";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";

const ACTIVE_STATUS = "ACTIVE";

export class ResellerOutletService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** Create outlet after validating reseller and outlet code. */
  async createOutlet(
    tenantId: string | null,
    resellerId: string,
    data: Omit<CreateOutletData, "tenantId" | "resellerId">,
  ): Promise<ResellerOutletDTO> {
    await this.assertActiveReseller(tenantId, resellerId);
    const normalized = this.normalizeCreateOutlet(tenantId, resellerId, data);
    const existing = await this.repository.findOutletByCode(
      tenantId,
      resellerId,
      normalized.code,
    );
    if (existing) {
      throw new Error("Kode outlet sudah digunakan");
    }
    const outlet = await this.repository.createOutlet(normalized);
    return ResellerMapper.toOutletDTO(outlet);
  }

  /** List reseller outlets. */
  async listOutlets(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerOutletDTO[]> {
    await this.assertResellerExists(tenantId, resellerId);
    const outlets = await this.repository.findOutletsByResellerId(
      tenantId,
      resellerId,
    );
    return outlets.map((outlet) => ResellerMapper.toOutletDTO(outlet));
  }

  /** Get outlet detail and validate reseller ownership. */
  async getOutletById(
    tenantId: string | null,
    resellerId: string,
    outletId: string,
  ): Promise<ResellerOutletDTO | null> {
    const outlet = await this.repository.findOutletById(tenantId, outletId);
    if (!outlet || outlet.resellerId !== resellerId) {
      return null;
    }
    return ResellerMapper.toOutletDTO(outlet);
  }

  /** Update outlet after validating ownership. */
  async updateOutlet(
    tenantId: string | null,
    resellerId: string,
    outletId: string,
    data: UpdateOutletData,
  ): Promise<ResellerOutletDTO> {
    await this.assertOutletBelongsToReseller(tenantId, resellerId, outletId);
    const updated = await this.repository.updateOutlet(
      tenantId,
      outletId,
      data,
    );
    return ResellerMapper.toOutletDTO(updated);
  }

  /** Soft-delete outlet after validating ownership. */
  async deleteOutlet(
    tenantId: string | null,
    resellerId: string,
    outletId: string,
  ): Promise<void> {
    await this.assertOutletBelongsToReseller(tenantId, resellerId, outletId);
    await this.repository.softDeleteOutlet(tenantId, outletId);
  }

  /** Validate outlet belongs to reseller and is active. */
  async assertOutletBelongsToReseller(
    tenantId: string | null,
    resellerId: string,
    outletId: string,
  ): Promise<void> {
    const outlet = await this.repository.findOutletById(tenantId, outletId);
    if (!outlet) {
      throw new Error("Outlet tidak ditemukan");
    }
    if (outlet.resellerId !== resellerId) {
      throw new Error("Outlet tidak sesuai dengan reseller");
    }
    if (outlet.status !== ACTIVE_STATUS) {
      throw new Error("Outlet tidak aktif");
    }
  }

  private async assertResellerExists(
    tenantId: string | null,
    resellerId: string,
  ): Promise<void> {
    const reseller = await this.repository.findById(tenantId, resellerId);
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
  }

  private async assertActiveReseller(
    tenantId: string | null,
    resellerId: string,
  ): Promise<void> {
    const reseller = await this.repository.findById(tenantId, resellerId);
    if (!reseller) {
      throw new Error("Reseller tidak ditemukan");
    }
    if (reseller.status !== ACTIVE_STATUS) {
      throw new Error("Reseller tidak aktif");
    }
  }

  private normalizeCreateOutlet(
    tenantId: string | null,
    resellerId: string,
    data: Omit<CreateOutletData, "tenantId" | "resellerId">,
  ): CreateOutletData {
    return {
      tenantId,
      resellerId,
      code: data.code.trim(),
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
    };
  }
}

let resellerOutletService: ResellerOutletService | null = null;

/** Get singleton reseller outlet service. */
export function getResellerOutletService(): ResellerOutletService {
  if (!resellerOutletService) {
    resellerOutletService = new ResellerOutletService();
  }
  return resellerOutletService;
}
