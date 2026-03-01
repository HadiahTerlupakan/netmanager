import { prismaBilling } from '@/lib/prisma-billing'
import type { MixRadiusConfig } from '@/prisma/generated/billing'

export class MixRadiusConfigRepository {
  /**
   * Get the currently active configuration
   */
  async getActiveConfig() {
    return prismaBilling.mixRadiusConfig.findFirst({
      where: { isDefault: true },
    })
  }

  /**
   * Get all configurations
   */
  async getAllConfigs() {
    return prismaBilling.mixRadiusConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get config by ID
   */
  async getConfigById(id: string) {
    return prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
    })
  }

  /**
   * Create a new configuration
   */
  async createConfig(data: Omit<MixRadiusConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    // If setting as active, deactivate others
    if (data.isDefault) {
      await this.deactivateAll()
    }

    return prismaBilling.mixRadiusConfig.create({
      data: {
        ...data,
        name: data.name || 'Default'
      },
    })
  }

  /**
   * Update a configuration
   */
  async updateConfig(id: string, data: Partial<Omit<MixRadiusConfig, 'id' | 'createdAt' | 'updatedAt'>>) {
    // If setting as active, deactivate others
    if (data.isDefault === true) {
      await this.deactivateAll(id)
    }

    return prismaBilling.mixRadiusConfig.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete a configuration
   */
  async deleteConfig(id: string) {
    return prismaBilling.mixRadiusConfig.delete({
      where: { id },
    })
  }

  /**
   * Set a configuration as active
   */
  async setActive(id: string) {
    await this.deactivateAll(id)
    return prismaBilling.mixRadiusConfig.update({
      where: { id },
      data: { isDefault: true },
    })
  }

  /**
   * Helper to deactivate all configs except one (optional)
   */
  private async deactivateAll(exceptId?: string) {
    await prismaBilling.mixRadiusConfig.updateMany({
      where: {
        ...(exceptId ? { id: { not: exceptId } } : {}),
        isDefault: true,
      },
      data: { isDefault: false },
    })
  }
}

export const mixRadiusConfigRepo = new MixRadiusConfigRepository()
