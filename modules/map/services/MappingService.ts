import type {
  CreateMapEdgeDTO,
  CreateMapNodeDTO,
  MapDataDTO,
  MapEdgeDTO,
  MapNodeListItemDTO,
  MapSettingsDTO,
  MapStatisticsDTO,
  UpdateMapEdgeDTO,
  UpdateMapNodeDTO,
  UpdateMapSettingsDTO,
} from "../dto/MapDTO";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import type { TenantContext } from "../utils/tenantContext";
import { MapFactory } from "../factories/MapFactory";
import { MapMapper } from "../mappers/MapMapper";
import { canAddOutgoingEdge } from "../validators/mapCapacityValidator";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { MapListFilters } from "../types/MappingRepositoryTypes";
import { prisma } from "@/lib/prisma";

export class MappingService {
  constructor(private readonly repository: IMappingRepository) {}

  async getMappingData(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapDataDTO> {
    const [nodes, edges, settings] = await Promise.all([
      this.repository.findAllNodes(ctx, filters),
      this.repository.findAllEdges(ctx, filters),
      this.repository.getSettings(ctx),
    ]);
    return MapMapper.toMapDataDTO({ nodes, edges, settings });
  }

  async getNodes(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapNodeListItemDTO[]> {
    const nodes = await this.repository.findAllNodes(ctx, filters);
    return MapMapper.toNodeDTOList(nodes);
  }

  async getNodeById(ctx: TenantContext, nodeId: string) {
    const node = await this.repository.findNodeById(ctx, nodeId);
    if (!node) return null;
    const connectedEdges = await this.repository.findEdgesByNode(ctx, nodeId);
    return MapMapper.toNodeDetailDTO(node, connectedEdges);
  }

  async getEdges(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapEdgeDTO[]> {
    const edges = await this.repository.findAllEdges(ctx, filters);
    return MapMapper.toEdgeDTOList(edges);
  }

  async getEdgeById(
    ctx: TenantContext,
    edgeId: string,
  ): Promise<MapEdgeDTO | null> {
    const edge = await this.repository.findEdgeById(ctx, edgeId);
    return edge ? MapMapper.toEdgeDTO(edge) : null;
  }

  async getSettings(ctx: TenantContext): Promise<MapSettingsDTO | null> {
    const settings = await this.repository.getSettings(ctx);
    return MapMapper.toSettingsDTO(settings);
  }

  async getStatistics(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapStatisticsDTO> {
    const [nodes, edges] = await Promise.all([
      this.repository.findAllNodes(ctx, filters),
      this.repository.findAllEdges(ctx, filters),
    ]);
    return MapMapper.toStatisticsDTO(nodes, edges);
  }

  async createNode(
    ctx: TenantContext,
    data: CreateMapNodeDTO,
  ): Promise<MapNodeListItemDTO> {
    await this.assertSiteAssignable(ctx, data.siteId);
    const nodePayload = MapFactory.createFromDTO(data);
    const node = await this.repository.createNode(ctx, nodePayload);
    return MapMapper.toNodeDTO(node);
  }

  async updateNode(ctx: TenantContext, nodeId: string, data: UpdateMapNodeDTO) {
    await this.ensureNodeExists(ctx, nodeId);
    if (data.siteId !== undefined) {
      await this.assertSiteAssignable(ctx, data.siteId);
    }
    const node = await this.repository.updateNode(ctx, nodeId, data);
    return MapMapper.toNodeDTO(node);
  }

  async createEdge(
    ctx: TenantContext,
    data: CreateMapEdgeDTO,
  ): Promise<MapEdgeDTO> {
    await this.ensureEdgeNodesExist(ctx, data.source, data.target);
    await this.ensureSourceHasCapacity(ctx, data.source);
    const edge = await this.repository.createEdge(ctx, data);
    return MapMapper.toEdgeDTO(edge);
  }

  async updateEdge(ctx: TenantContext, edgeId: string, data: UpdateMapEdgeDTO) {
    await this.ensureEdgeExists(ctx, edgeId);
    const edge = await this.repository.updateEdge(ctx, edgeId, data);
    return MapMapper.toEdgeDTO(edge);
  }

  async updateSettings(
    ctx: TenantContext,
    data: UpdateMapSettingsDTO,
  ): Promise<MapSettingsDTO> {
    const settings = await this.repository.updateSettings(ctx, data);
    return MapMapper.toSettingsDTORequired(settings);
  }

  async deleteNode(
    ctx: TenantContext,
    nodeId: string,
  ): Promise<MapNodeListItemDTO> {
    const node = await this.repository.deleteNode(ctx, nodeId);
    return MapMapper.toNodeDTO(node);
  }

  async deleteEdge(ctx: TenantContext, edgeId: string): Promise<MapEdgeDTO> {
    const edge = await this.repository.deleteEdge(ctx, edgeId);
    return MapMapper.toEdgeDTO(edge);
  }

  private async assertSiteAssignable(
    ctx: TenantContext,
    siteId: string | null | undefined,
  ): Promise<void> {
    if (siteId === null || siteId === undefined) {
      return;
    }

    const site = await prisma.sites.findFirst({
      where: { id: siteId },
      select: { id: true, tenantId: true },
    });

    if (!site) {
      throw new ValidationError("Site tidak ditemukan", { siteId });
    }

    if (
      !ctx.isSuperAdmin &&
      ctx.tenantId &&
      site.tenantId &&
      site.tenantId !== ctx.tenantId
    ) {
      throw new ValidationError("Site tidak termasuk tenant Anda", { siteId });
    }
  }

  private async ensureNodeExists(
    ctx: TenantContext,
    nodeId: string,
  ): Promise<void> {
    const node = await this.repository.findNodeById(ctx, nodeId);
    if (!node) throw new NotFoundError("Node");
  }

  private async ensureEdgeExists(
    ctx: TenantContext,
    edgeId: string,
  ): Promise<void> {
    const edge = await this.repository.findEdgeById(ctx, edgeId);
    if (!edge) throw new NotFoundError("Edge");
  }

  private async ensureEdgeNodesExist(
    ctx: TenantContext,
    source: string,
    target: string,
  ): Promise<void> {
    const [sourceNode, targetNode] = await Promise.all([
      this.repository.findNodeById(ctx, source),
      this.repository.findNodeById(ctx, target),
    ]);
    if (!sourceNode) throw new NotFoundError("Source node");
    if (!targetNode) throw new NotFoundError("Target node");
  }

  private async ensureSourceHasCapacity(
    ctx: TenantContext,
    sourceNodeId: string,
  ): Promise<void> {
    const sourceNode = await this.repository.findNodeById(ctx, sourceNodeId);
    if (!sourceNode) throw new NotFoundError("Source node");

    const currentConnections = await this.repository.countEdgesFromSource(
      ctx,
      sourceNodeId,
    );
    if (canAddOutgoingEdge(sourceNode, currentConnections)) return;

    throw new ValidationError(`Kapasitas penuh: ${sourceNode.name}`, {
      node: sourceNode.name,
      used: currentConnections,
      capacity: sourceNode.capacity,
    });
  }
}
