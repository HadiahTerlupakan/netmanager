import type { CreateMapNodeDTO } from "../dto/MapDTO";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import type { TenantContext } from "../utils/tenantContext";
import type { SyncMapDataInput } from "../types/MappingRepositoryTypes";
import { MappingService } from "./MappingService";

export interface UserPasswordVerifier {
  verifyUserPassword(email: string, password: string): Promise<boolean>;
}

export class MappingAdminService {
  constructor(
    private readonly repository: IMappingRepository,
    private readonly mappingService: MappingService,
    private readonly userPasswordVerifier: UserPasswordVerifier,
  ) {}

  async verifyResetPassword(email: string, password: string): Promise<boolean> {
    return this.userPasswordVerifier.verifyUserPassword(email, password);
  }

  async resetAllMappingData(ctx: TenantContext): Promise<void> {
    await this.repository.resetAllMappingData(ctx);
  }

  async syncAllMappingData(
    ctx: TenantContext,
    data: SyncMapDataInput,
  ): Promise<void> {
    await this.repository.syncAllMappingData(ctx, data);
  }

  async createNode(ctx: TenantContext, data: CreateMapNodeDTO) {
    return this.mappingService.createNode(ctx, data);
  }
}
