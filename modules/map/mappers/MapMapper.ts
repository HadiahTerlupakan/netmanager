import type {
  MapDataDTO,
  MapEdgeDTO,
  MapNodeDetailDTO,
  MapNodeListItemDTO,
  MapSettingsDTO,
  MapStatisticsDTO,
} from "../dto/MapDTO";
import type { MapEdge } from "../domain/entities/MapEdge";
import type { MapNode } from "../domain/entities/MapNode";
import type { MapSettings } from "../domain/entities/MapSettings";
import {
  UTILIZATION_DECIMAL_FACTOR,
  UTILIZATION_PERCENT_MULTIPLIER,
} from "../utils/mapConstants";

interface PrismaMappingNodeRecord {
  nodeId: string;
  type: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  splitter: string | null;
  pppoe: string | null;
  serialNumber: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  attenuationIn: number | null;
  attenuationOut: number | null;
  inputCoreColor: string | null;
  photo: string | null;
  metadata: unknown;
  tenantId: string | null;
  siteId: string | null;
}

interface PrismaMappingEdgeRecord {
  edgeId: string;
  source: string;
  target: string;
  fiberType: string | null;
  distance: number | null;
  waypoints: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  name: string | null;
  tenantId: string | null;
  sourceNode?: { name: string | null } | null;
  targetNode?: { name: string | null } | null;
}

interface PrismaMapSettingsRecord {
  id: number;
  centerLat: string | null;
  centerLng: string | null;
  maxZoomIn: string | null;
  maxZoomOut: string | null;
  defaultZoom: string | null;
  updatedAt: Date;
  tenantId: string | null;
}

export class MapMapper {
  /** Map Prisma node record to domain entity. */
  static toDomainNode(record: PrismaMappingNodeRecord): MapNode {
    return {
      ...record,
      metadata: this.parseMetadata(record.metadata),
    };
  }

  /** Map Prisma edge record to domain entity. */
  static toDomainEdge(record: PrismaMappingEdgeRecord): MapEdge {
    return {
      edgeId: record.edgeId,
      source: record.source,
      target: record.target,
      fiberType: record.fiberType,
      distance: record.distance,
      waypoints: record.waypoints,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      name: record.name,
      tenantId: record.tenantId,
      sourceNodeName: record.sourceNode?.name ?? null,
      targetNodeName: record.targetNode?.name ?? null,
    };
  }

  /** Map Prisma settings record to domain entity. */
  static toDomainSettings(record: PrismaMapSettingsRecord): MapSettings {
    return { ...record };
  }

  /** Map domain node to response DTO. */
  static toNodeDTO(entity: MapNode): MapNodeListItemDTO {
    return {
      nodeId: entity.nodeId,
      type: entity.type,
      name: entity.name,
      latitude: entity.latitude,
      longitude: entity.longitude,
      capacity: entity.capacity,
      splitter: entity.splitter,
      pppoe: entity.pppoe,
      serialNumber: entity.serialNumber,
      notes: entity.notes,
      attenuationIn: entity.attenuationIn,
      attenuationOut: entity.attenuationOut,
      inputCoreColor: entity.inputCoreColor,
      photo: entity.photo,
      metadata: entity.metadata,
      siteId: entity.siteId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain nodes to response DTOs. */
  static toNodeDTOList(entities: MapNode[]): MapNodeListItemDTO[] {
    return entities.map((entity) => this.toNodeDTO(entity));
  }

  /** Map domain edge to response DTO. */
  static toEdgeDTO(entity: MapEdge): MapEdgeDTO {
    return {
      edgeId: entity.edgeId,
      source: entity.source,
      target: entity.target,
      fiberType: entity.fiberType,
      distance: entity.distance,
      waypoints: entity.waypoints,
      notes: entity.notes,
      name: entity.name,
      sourceNodeName: entity.sourceNodeName,
      targetNodeName: entity.targetNodeName,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain edges to response DTOs. */
  static toEdgeDTOList(entities: MapEdge[]): MapEdgeDTO[] {
    return entities.map((entity) => this.toEdgeDTO(entity));
  }

  /** Map domain settings to response DTO. Returns null when entity is null. */
  static toSettingsDTO(entity: MapSettings | null): MapSettingsDTO | null {
    if (!entity) {
      return null;
    }

    return this.toSettingsDTORequired(entity);
  }

  /** Map non-null domain settings to response DTO. Use when entity is guaranteed non-null. */
  static toSettingsDTORequired(entity: MapSettings): MapSettingsDTO {
    return {
      centerLat: entity.centerLat,
      centerLng: entity.centerLng,
      maxZoomIn: entity.maxZoomIn,
      maxZoomOut: entity.maxZoomOut,
      defaultZoom: entity.defaultZoom,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain node detail to response DTO. */
  static toNodeDetailDTO(
    entity: MapNode,
    connectedEdges: MapEdge[],
  ): MapNodeDetailDTO {
    return {
      ...this.toNodeDTO(entity),
      connectedEdges: this.toEdgeDTOList(connectedEdges),
    };
  }

  /** Build map data response DTO. */
  static toMapDataDTO(input: {
    nodes: MapNode[];
    edges: MapEdge[];
    settings: MapSettings | null;
  }): MapDataDTO {
    return {
      nodes: this.toNodeDTOList(input.nodes),
      edges: this.toEdgeDTOList(input.edges),
      settings: this.toSettingsDTO(input.settings),
    };
  }

  /** Calculate statistics DTO from domain entities. */
  static toStatisticsDTO(nodes: MapNode[], edges: MapEdge[]): MapStatisticsDTO {
    const typeCountMap = new Map<string, number>();
    let totalCapacity = 0;
    let usedCapacity = 0;

    for (const node of nodes) {
      this.incrementTypeCount(typeCountMap, node.type);
      totalCapacity += node.capacity;
      usedCapacity += this.getUsedCapacity(node);
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalCapacity,
      usedCapacity,
      utilizationPercent: this.calculateUtilization(
        totalCapacity,
        usedCapacity,
      ),
      nodesByType: this.toTypeCountList(typeCountMap),
    };
  }

  /** Parse JSON metadata into object form. */
  private static parseMetadata(value: unknown): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return this.parseStringMetadata(value);
    }

    return value as Record<string, unknown>;
  }

  /** Parse metadata string safely. */
  private static parseStringMetadata(
    value: string,
  ): Record<string, unknown> | null {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Increment node type counter. */
  private static incrementTypeCount(
    typeCountMap: Map<string, number>,
    type: string,
  ): void {
    const currentCount = typeCountMap.get(type) ?? 0;
    typeCountMap.set(type, currentCount + 1);
  }

  /** Convert type count map to DTO list. */
  private static toTypeCountList(
    typeCountMap: Map<string, number>,
  ): Array<{ type: string; count: number }> {
    return Array.from(typeCountMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  }

  /** Read used capacity from metadata or zero fallback. */
  private static getUsedCapacity(node: MapNode): number {
    const usedPorts = node.metadata?.usedPorts;
    return typeof usedPorts === "number" ? usedPorts : 0;
  }

  /** Calculate utilization percentage with one decimal precision. */
  private static calculateUtilization(
    totalCapacity: number,
    usedCapacity: number,
  ): number {
    if (totalCapacity <= 0) {
      return 0;
    }

    const rawValue =
      (usedCapacity / totalCapacity) * UTILIZATION_PERCENT_MULTIPLIER;

    return (
      Math.round(rawValue * UTILIZATION_DECIMAL_FACTOR) /
      UTILIZATION_DECIMAL_FACTOR
    );
  }
}
