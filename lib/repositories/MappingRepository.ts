
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export class MappingRepository {
  /**
   * Get all mapping nodes
   */
  async findAllNodes() {
    return await prisma.mappingNode.findMany();
  }

  /**
   * Get all mapping edges
   */
  async findAllEdges() {
    return await prisma.mappingEdge.findMany();
  }

  /**
   * Get map settings
   */
  async getSettings() {
    // We assume there's only one settings row, or we get the latest
    return await prisma.mapSettings.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Create or update map settings
   */
  async updateSettings(data: Prisma.MapSettingsCreateInput) {
    const existing = await this.getSettings();
    if (existing) {
      return await prisma.mapSettings.update({
        where: { id: existing.id },
        data
      });
    } else {
      return await prisma.mapSettings.create({
        data
      });
    }
  }

  /**
   * Create a new node
   */
  async createNode(data: Prisma.MappingNodeCreateInput) {
    return await prisma.mappingNode.create({
      data
    });
  }

  /**
   * Create a new edge
   */
  async createEdge(data: Prisma.MappingEdgeUncheckedCreateInput) {
    return await prisma.mappingEdge.create({
      data
    });
  }

  /**
   * Delete a node
   */
  async deleteNode(nodeId: string) {
    return await prisma.mappingNode.delete({
      where: { nodeId }
    });
  }

  /**
   * Delete an edge
   */
  async deleteEdge(edgeId: string) {
    return await prisma.mappingEdge.delete({
      where: { edgeId }
    });
  }
}
