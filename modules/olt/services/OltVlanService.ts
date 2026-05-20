import { logger } from "@/lib/logger";
import { VlanConfigRepository } from "../repositories/VlanConfigRepository";

interface CreateVlanInput {
  tenantId: string;
  oltId: string;
  ponPort?: number;
  vlanId: number;
  vlanName?: string;
  purpose?: string;
}

export class OltVlanService {
  private vlanRepo = new VlanConfigRepository();

  async getVlanConfigs(oltId: string) {
    return this.vlanRepo.findByOlt(oltId);
  }

  async createVlanConfig(input: CreateVlanInput) {
    const config = await this.vlanRepo.create(input);
    logger.info(
      `[OltVlan] Created VLAN ${input.vlanId} for OLT ${input.oltId}`,
    );
    return config;
  }

  async deleteVlanConfig(id: string) {
    await this.vlanRepo.delete(id);
    logger.info(`[OltVlan] Deleted VLAN config ${id}`);
  }

  async getVlanForOnu(oltId: string, ponPort: number): Promise<number | null> {
    const config = await this.vlanRepo.findByOltAndPort(oltId, ponPort);
    return config?.vlanId ?? null;
  }
}
