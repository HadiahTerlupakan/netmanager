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
import { MapFactory } from "../factories/MapFactory";
import { MapMapper } from "../mappers/MapMapper";
import { canAddOutgoingEdge } from "../validators/mapCapacityValidator";

export class MappingService {
  constructor(private readonly repository: IMappingRepository) {}

  /** Get all map data as DTOs. */
  async getMappingData(): Promise<MapDataDTO> {
    const [nodes, edges, settings] = await Promise.all([
      this.repository.findAllNodes(),
      this.repository.findAllEdges(),
      this.repository.getSettings(),
    ]);

    return MapMapper.toMapDataDTO({ nodes, edges, settings });
  }

  /** Get all nodes as DTOs. */
  async getNodes(): Promise<MapNodeListItemDTO[]> {
    const nodes = await this.repository.findAllNodes();
    return MapMapper.toNodeDTOList(nodes);
  }

  /** Get single node by ID as DTO. */
  async getNodeById(nodeId: string) {
    const node = await this.repository.findNodeById(nodeId);
    if (!node) {
      return null;
    }

    const allEdges = await this.repository.findAllEdges();
    const connectedEdges = allEdges.filter((edge) =>
      this.isConnected(edge, nodeId),
    );
    return MapMapper.toNodeDetailDTO(node, connectedEdges);
  }

  /** Get all edges as DTOs. */
  async getEdges(): Promise<MapEdgeDTO[]> {
    const edges = await this.repository.findAllEdges();
    return MapMapper.toEdgeDTOList(edges);
  }

  /** Get single edge by ID as DTO. */
  async getEdgeById(edgeId: string): Promise<MapEdgeDTO | null> {
    const edge = await this.repository.findEdgeById(edgeId);
    return edge ? MapMapper.toEdgeDTO(edge) : null;
  }

  /** Get settings as DTO. */
  async getSettings(): Promise<MapSettingsDTO | null> {
    const settings = await this.repository.getSettings();
    return MapMapper.toSettingsDTO(settings);
  }

  /** Calculate mapping statistics from domain entities. */
  async getStatistics(): Promise<MapStatisticsDTO> {
    const [nodes, edges] = await Promise.all([
      this.repository.findAllNodes(),
      this.repository.findAllEdges(),
    ]);

    return MapMapper.toStatisticsDTO(nodes, edges);
  }

  /** Create a new node and return DTO. */
  async createNode(data: CreateMapNodeDTO): Promise<MapNodeListItemDTO> {
    const nodePayload = MapFactory.createFromDTO(data);
    const node = await this.repository.createNode(nodePayload);
    return MapMapper.toNodeDTO(node);
  }

  /** Update a node and return DTO. */
  async updateNode(nodeId: string, data: UpdateMapNodeDTO) {
    await this.ensureNodeExists(nodeId);
    const node = await this.repository.updateNode(nodeId, data);
    return MapMapper.toNodeDTO(node);
  }

  /** Create a new edge and return DTO. */
  async createEdge(data: CreateMapEdgeDTO): Promise<MapEdgeDTO> {
    await this.ensureEdgeNodesExist(data.source, data.target);
    await this.ensureSourceHasCapacity(data.source);
    const edge = await this.repository.createEdge(data);
    return MapMapper.toEdgeDTO(edge);
  }

  /** Update an edge and return DTO. */
  async updateEdge(edgeId: string, data: UpdateMapEdgeDTO) {
    await this.ensureEdgeExists(edgeId);
    const edge = await this.repository.updateEdge(edgeId, data);
    return MapMapper.toEdgeDTO(edge);
  }

  /** Update settings and return DTO. */
  async updateSettings(data: UpdateMapSettingsDTO): Promise<MapSettingsDTO> {
    const settings = await this.repository.updateSettings(data);
    return MapMapper.toSettingsDTO(settings) as MapSettingsDTO;
  }

  /** Delete node and return DTO. */
  async deleteNode(nodeId: string): Promise<MapNodeListItemDTO> {
    await this.ensureNodeExists(nodeId);
    const node = await this.repository.deleteNode(nodeId);
    return MapMapper.toNodeDTO(node);
  }

  /** Delete edge and return DTO. */
  async deleteEdge(edgeId: string): Promise<MapEdgeDTO> {
    await this.ensureEdgeExists(edgeId);
    const edge = await this.repository.deleteEdge(edgeId);
    return MapMapper.toEdgeDTO(edge);
  }

  /** Check whether edge is connected to node. */
  private isConnected(
    edge: { source: string; target: string },
    nodeId: string,
  ): boolean {
    return edge.source === nodeId || edge.target === nodeId;
  }

  /** Ensure the requested node exists. */
  private async ensureNodeExists(nodeId: string): Promise<void> {
    const existingNode = await this.repository.findNodeById(nodeId);
    if (!existingNode) {
      throw new Error("NODE_NOT_FOUND");
    }
  }

  /** Ensure the requested edge exists. */
  private async ensureEdgeExists(edgeId: string): Promise<void> {
    const existingEdge = await this.repository.findEdgeById(edgeId);
    if (!existingEdge) {
      throw new Error("EDGE_NOT_FOUND");
    }
  }

  /** Ensure source and target nodes exist before edge creation. */
  private async ensureEdgeNodesExist(
    source: string,
    target: string,
  ): Promise<void> {
    const [sourceNode, targetNode] = await Promise.all([
      this.repository.findNodeById(source),
      this.repository.findNodeById(target),
    ]);

    if (!sourceNode) {
      throw new Error("SOURCE_NODE_NOT_FOUND");
    }

    if (!targetNode) {
      throw new Error("TARGET_NODE_NOT_FOUND");
    }
  }

  /** Ensure a source node has available capacity. */
  private async ensureSourceHasCapacity(sourceNodeId: string): Promise<void> {
    const sourceNode = await this.repository.findNodeById(sourceNodeId);
    if (!sourceNode) {
      throw new Error("SOURCE_NODE_NOT_FOUND");
    }

    const currentConnections =
      await this.repository.countEdgesFromSource(sourceNodeId);
    if (canAddOutgoingEdge(sourceNode, currentConnections)) {
      return;
    }

    throw new Error(
      `CAPACITY_FULL:${sourceNode.name}:${currentConnections}/${sourceNode.capacity}`,
    );
  }
}
