
import { MappingRepository } from "@/lib/repositories/MappingRepository";
import { Prisma } from "@prisma/client";

export class MappingService {
  private repository: MappingRepository;

  constructor() {
    this.repository = new MappingRepository();
  }

  /**
   * Get all map data (nodes, edges, settings)
   */
  async getMappingData() {
    const [nodes, edges, settings] = await Promise.all([
      this.repository.findAllNodes(),
      this.repository.findAllEdges(),
      this.repository.getSettings(),
    ]);

    return {
      nodes,
      edges,
      settings,
    };
  }

  /**
   * Get nodes only
   */
  async getNodes() {
    return await this.repository.findAllNodes();
  }

  /**
   * Get single node by ID
   */
  async getNodeById(nodeId: string) {
    return await this.repository.findNodeById(nodeId);
  }

  /**
   * Get edges only
   */
  async getEdges() {
    return await this.repository.findAllEdges();
  }

  /**
   * Get single edge by ID
   */
  async getEdgeById(edgeId: string) {
    return await this.repository.findEdgeById(edgeId);
  }

  /**
   * Get settings only
   */
  async getSettings() {
    return await this.repository.getSettings();
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    return await this.repository.getStatistics();
  }

  /**
   * Create a new node with validation
   */
  async createNode(data: Prisma.MappingNodeCreateInput) {
    return await this.repository.createNode(data);
  }

  /**
   * Update a node
   */
  async updateNode(nodeId: string, data: Prisma.MappingNodeUpdateInput) {
    const existing = await this.repository.findNodeById(nodeId);
    if (!existing) {
      throw new Error("NODE_NOT_FOUND");
    }
    return await this.repository.updateNode(nodeId, data);
  }

  /**
   * Create a new edge with capacity validation
   */
  async createEdge(data: Prisma.MappingEdgeUncheckedCreateInput) {
    // Validate source node exists and check capacity
    const sourceNode = await this.repository.findNodeById(data.source);
    if (!sourceNode) {
      throw new Error("SOURCE_NODE_NOT_FOUND");
    }

    const targetNode = await this.repository.findNodeById(data.target);
    if (!targetNode) {
      throw new Error("TARGET_NODE_NOT_FOUND");
    }

    // Check slot capacity for ODC and ODP nodes
    if (sourceNode.type === 'odc' || sourceNode.type === 'odp') {
      if (sourceNode.capacity && sourceNode.capacity > 0) {
        const currentConnections = await this.repository.countEdgesFromSource(data.source);
        if (currentConnections >= sourceNode.capacity) {
          throw new Error(`CAPACITY_FULL:${sourceNode.name}:${currentConnections}/${sourceNode.capacity}`);
        }
      }
    }

    return await this.repository.createEdge(data);
  }

  /**
   * Update an edge
   */
  async updateEdge(edgeId: string, data: Prisma.MappingEdgeUpdateInput) {
    const existing = await this.repository.findEdgeById(edgeId);
    if (!existing) {
      throw new Error("EDGE_NOT_FOUND");
    }
    return await this.repository.updateEdge(edgeId, data);
  }

  /**
   * Update map settings
   */
  async updateSettings(data: Prisma.MapSettingsCreateInput) {
    return await this.repository.updateSettings(data);
  }

  /**
   * Delete node (will also delete connected edges)
   */
  async deleteNode(nodeId: string) {
    const existing = await this.repository.findNodeById(nodeId);
    if (!existing) {
      throw new Error("NODE_NOT_FOUND");
    }
    return await this.repository.deleteNode(nodeId);
  }

  /**
   * Delete edge
   */
  async deleteEdge(edgeId: string) {
    const existing = await this.repository.findEdgeById(edgeId);
    if (!existing) {
      throw new Error("EDGE_NOT_FOUND");
    }
    return await this.repository.deleteEdge(edgeId);
  }
}
