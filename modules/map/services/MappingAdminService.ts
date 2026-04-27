import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { CreateMapNodeDTO } from "../dto/MapDTO";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import type { SyncMapDataInput } from "../types/MappingRepositoryTypes";
import { MappingService } from "./MappingService";

export class MappingAdminService {
  constructor(
    private readonly repository: IMappingRepository,
    private readonly mappingService: MappingService,
  ) {}

  /** Verify password before destructive map reset. */
  async verifyResetPassword(email: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return false;
    }

    return bcrypt.compare(password, user.passwordHash);
  }

  /** Delete all mapping nodes and edges. */
  async resetAllMappingData(): Promise<void> {
    await this.repository.resetAllMappingData();
  }

  /** Replace all mapping nodes and edges from sync payload. */
  async syncAllMappingData(data: SyncMapDataInput): Promise<void> {
    await this.repository.syncAllMappingData(data);
  }

  /** Create a node through the standard mapping service flow. */
  async createNode(data: CreateMapNodeDTO) {
    return this.mappingService.createNode(data);
  }
}
