import { logger } from "@/lib/logger";
import { BandwidthProfileRepository } from "../repositories/BandwidthProfileRepository";

interface CreateInput {
  tenantId: string;
  oltId: string;
  name: string;
  uploadRate: number;
  downloadRate: number;
  description?: string;
}

interface UpdateInput {
  name?: string;
  uploadRate?: number;
  downloadRate?: number;
  description?: string;
}

export class BandwidthProfileService {
  private repo = new BandwidthProfileRepository();

  async listByOlt(oltId: string) {
    return this.repo.findByOlt(oltId);
  }

  async listByTenant(tenantId: string) {
    return this.repo.findByTenant(tenantId);
  }

  async getById(id: string) {
    return this.repo.findById(id);
  }

  async create(input: CreateInput) {
    const profile = await this.repo.create(input);
    logger.info(
      `[BandwidthProfile] Created: ${input.name} (${input.downloadRate}/${input.uploadRate} kbps)`,
    );
    return profile;
  }

  async update(id: string, input: UpdateInput) {
    const profile = await this.repo.update(id, input);
    logger.info(`[BandwidthProfile] Updated: ${profile.name}`);
    return profile;
  }

  async delete(id: string) {
    await this.repo.delete(id);
    logger.info(`[BandwidthProfile] Deleted: ${id}`);
  }
}
