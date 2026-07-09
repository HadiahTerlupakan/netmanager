import type { MapEdge } from "../entities/MapEdge";
import type { MapNode } from "../entities/MapNode";
import type { MapSettings } from "../entities/MapSettings";
import type { TenantContext } from "../../utils/tenantContext";
import type {
  CreateMapEdgeInput,
  CreateMapNodeInput,
  SyncMapDataInput,
  UpdateMapEdgeInput,
  UpdateMapNodeInput,
  UpdateMapSettingsInput,
} from "../../types/MappingRepositoryTypes";

export interface IMappingRepository {
  findAllNodes(ctx: TenantContext): Promise<MapNode[]>;
  findAllEdges(ctx: TenantContext): Promise<MapEdge[]>;
  getSettings(ctx: TenantContext): Promise<MapSettings | null>;
  updateSettings(
    ctx: TenantContext,
    data: UpdateMapSettingsInput,
  ): Promise<MapSettings>;
  createNode(ctx: TenantContext, data: CreateMapNodeInput): Promise<MapNode>;
  createEdge(ctx: TenantContext, data: CreateMapEdgeInput): Promise<MapEdge>;
  findNodeById(ctx: TenantContext, nodeId: string): Promise<MapNode | null>;
  findEdgeById(ctx: TenantContext, edgeId: string): Promise<MapEdge | null>;
  findEdgesByNode(ctx: TenantContext, nodeId: string): Promise<MapEdge[]>;
  updateNode(
    ctx: TenantContext,
    nodeId: string,
    data: UpdateMapNodeInput,
  ): Promise<MapNode>;
  updateEdge(
    ctx: TenantContext,
    edgeId: string,
    data: UpdateMapEdgeInput,
  ): Promise<MapEdge>;
  deleteNode(ctx: TenantContext, nodeId: string): Promise<MapNode>;
  deleteEdge(ctx: TenantContext, edgeId: string): Promise<MapEdge>;
  countEdgesFromSource(
    ctx: TenantContext,
    sourceNodeId: string,
  ): Promise<number>;
  syncAllMappingData(ctx: TenantContext, data: SyncMapDataInput): Promise<void>;
  resetAllMappingData(ctx: TenantContext): Promise<void>;
}
