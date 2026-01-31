
import { prisma } from '@/lib/prisma'
import type { MixRadiusConfig } from '@prisma/client'

export class MixRadiusConfigRepository {
  /**
   * Get the currently active configuration
   */
  async getActiveConfig() {
    return prisma.mixRadiusConfig.findFirst({
      where: { isActive: true },
    })
  }

  /**
   * Get all configurations
   */
  async getAllConfigs() {
    return prisma.mixRadiusConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get config by ID
   */
  async getConfigById(id: string) {
    return prisma.mixRadiusConfig.findUnique({
      where: { id },
    })
  }

  /**
   * Create a new configuration
   */
  async createConfig(data: Omit<MixRadiusConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    // If setting as active, deactivate others
    if (data.isActive) {
      await this.deactivateAll()
    }

    return prisma.mixRadiusConfig.create({
      data,
    })
  }

  /**
   * Update a configuration
   */
  async updateConfig(id: string, data: Partial<Omit<MixRadiusConfig, 'id' | 'createdAt' | 'updatedAt'>>) {
    // If setting as active, deactivate others
    if (data.isActive === true) {
      await this.deactivateAll(id)
    }

    return prisma.mixRadiusConfig.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete a configuration
   */
  async deleteConfig(id: string) {
    return prisma.mixRadiusConfig.delete({
      where: { id },
    })
  }

  /**
   * Set a configuration as active
   */
  async setActive(id: string) {
    await this.deactivateAll(id)
    return prisma.mixRadiusConfig.update({
      where: { id },
      data: { isActive: true },
    })
  }

  /**
   * Helper to deactivate all configs except one (optional)
   */
  private async deactivateAll(exceptId?: string) {
    await prisma.mixRadiusConfig.updateMany({
      where: {
        ...(exceptId ? { id: { not: exceptId } } : {}),
        isActive: true,
      },
      data: { isActive: false },
    })
  }
}

export const mixRadiusConfigRepo = new MixRadiusConfigRepository()
