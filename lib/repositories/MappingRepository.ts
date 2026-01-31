
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
   * Find node by ID
   */
  async findNodeById(nodeId: string) {
    return await prisma.mappingNode.findUnique({
      where: { nodeId }
    });
  }

  /**
   * Find edge by ID
   */
  async findEdgeById(edgeId: string) {
    return await prisma.mappingEdge.findUnique({
      where: { edgeId }
    });
  }

  /**
   * Update a node
   */
  async updateNode(nodeId: string, data: Prisma.MappingNodeUpdateInput) {
    return await prisma.mappingNode.update({
      where: { nodeId },
      data
    });
  }

  /**
   * Update an edge
   */
  async updateEdge(edgeId: string, data: Prisma.MappingEdgeUpdateInput) {
    return await prisma.mappingEdge.update({
      where: { edgeId },
      data
    });
  }

  /**
   * Delete a node
   */
  async deleteNode(nodeId: string) {
    // First delete all edges connected to this node
    await prisma.mappingEdge.deleteMany({
      where: {
        OR: [
          { source: nodeId },
          { target: nodeId }
        ]
      }
    });
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

  /**
   * Count edges from a source node
   */
  async countEdgesFromSource(sourceNodeId: string) {
    return await prisma.mappingEdge.count({
      where: { source: sourceNodeId }
    });
  }

  /**
   * Get statistics for mapping data
   */
  async getStatistics() {
    const [totalNodes, totalEdges, nodesByType] = await Promise.all([
      prisma.mappingNode.count(),
      prisma.mappingEdge.count(),
      prisma.mappingNode.groupBy({
        by: ['type'],
        _count: { type: true }
      })
    ]);

    return {
      totalNodes,
      totalEdges,
      nodesByType: nodesByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
