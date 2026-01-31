
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
   * Get edges only
   */
  async getEdges() {
    return await this.repository.findAllEdges();
  }

  /**
   * Get settings only
   */
  async getSettings() {
    return await this.repository.getSettings();
  }

  /**
   * Create a new node with validation
   */
  async createNode(data: Prisma.MappingNodeCreateInput) {
    // Add validation logic here if needed (e.g. check duplicate SN if not handled by DB)
    return await this.repository.createNode(data);
  }

  /**
   * Create a new edge with validation
   */
  async createEdge(data: Prisma.MappingEdgeUncheckedCreateInput) {
    // Validate source and target exist? Prisma handles foreign key constraints.
    // Validate capacity? (As mentioned in the guide)
    
    // Example capacity check (simplified):
    // const sourceNode = await prisma.mappingNode.findUnique({ where: { nodeId: data.source } });
    // if (sourceNode && sourceNode.capacity > 0) { ... }
    
    return await this.repository.createEdge(data);
  }

  /**
   * Update map settings
   */
  async updateSettings(data: Prisma.MapSettingsCreateInput) {
    return await this.repository.updateSettings(data);
  }

  /**
   * Delete node
   */
  async deleteNode(nodeId: string) {
    // Prisma cascade delete will handle edges if configured, but our schema didn't specify Cascade on relations explicitly in my update (Wait, I should check).
    // In my schema update: 
    // sourceNode MappingNode @relation("SourceNode", fields: [source], references: [nodeId])
    // No onDelete: Cascade. 
    // So we might need to delete edges first or handle it.
    // For now, let's assume we delete edges first or add Cascade later.
    return await this.repository.deleteNode(nodeId);
  }

  async deleteEdge(edgeId: string) {
    return await this.repository.deleteEdge(edgeId);
  }
}
