import type { MapEdge } from "../entities/MapEdge";
import type { MapNode } from "../entities/MapNode";
import type { MapSettings } from "../entities/MapSettings";
import type { LingkupPeta, TenantContext } from "../../utils/tenantContext";
import type {
  CreateMapEdgeInput,
  CreateMapNodeInput,
  MapListFilters,
  SyncMapDataInput,
  UpdateMapEdgeInput,
  UpdateMapNodeInput,
  UpdateMapSettingsInput,
} from "../../types/MappingRepositoryTypes";

export interface IMappingRepository {
  findAllNodes(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapNode[]>;
  findAllEdges(
    ctx: TenantContext,
    filters?: MapListFilters,
  ): Promise<MapEdge[]>;
  getSettings(ctx: TenantContext): Promise<MapSettings | null>;
  updateSettings(
    ctx: TenantContext,
    data: UpdateMapSettingsInput,
  ): Promise<MapSettings>;
  createNode(ctx: TenantContext, data: CreateMapNodeInput): Promise<MapNode>;
  createEdge(ctx: TenantContext, data: CreateMapEdgeInput): Promise<MapEdge>;
  findNodeById(
    ctx: TenantContext,
    nodeId: string,
    lingkup?: LingkupPeta,
  ): Promise<MapNode | null>;
  findEdgeById(
    ctx: TenantContext,
    edgeId: string,
    lingkup?: LingkupPeta,
  ): Promise<MapEdge | null>;
  findEdgesByNode(
    ctx: TenantContext,
    nodeId: string,
    lingkup?: LingkupPeta,
  ): Promise<MapEdge[]>;
  updateNode(
    ctx: TenantContext,
    nodeId: string,
    data: UpdateMapNodeInput,
    lingkup?: LingkupPeta,
  ): Promise<MapNode>;
  updateEdge(
    ctx: TenantContext,
    edgeId: string,
    data: UpdateMapEdgeInput,
    lingkup?: LingkupPeta,
  ): Promise<MapEdge>;
  deleteNode(ctx: TenantContext, nodeId: string): Promise<MapNode>;
  deleteEdge(ctx: TenantContext, edgeId: string): Promise<MapEdge>;
  countEdgesFromSource(
    ctx: TenantContext,
    sourceNodeId: string,
    lingkup?: LingkupPeta,
  ): Promise<number>;
  syncAllMappingData(ctx: TenantContext, data: SyncMapDataInput): Promise<void>;
  resetAllMappingData(ctx: TenantContext): Promise<void>;
  /** Upsert nodes by nodeId (merge). Returns per-row actions. */
  upsertNodes(
    ctx: TenantContext,
    nodes: CreateMapNodeInput[],
  ): Promise<{
    created: number;
    updated: number;
    actions: Array<"created" | "updated">;
  }>;
}
