import type { MapEdge } from "../entities/MapEdge";
import type { MapNode } from "../entities/MapNode";
import type { MapSettings } from "../entities/MapSettings";
import type {
  CreateMapEdgeInput,
  CreateMapNodeInput,
  SyncMapDataInput,
  UpdateMapEdgeInput,
  UpdateMapNodeInput,
  UpdateMapSettingsInput,
} from "../../types/MappingRepositoryTypes";

export interface IMappingRepository {
  /** Get all mapping nodes. */
  findAllNodes(): Promise<MapNode[]>;

  /** Get all mapping edges. */
  findAllEdges(): Promise<MapEdge[]>;

  /** Get latest map settings. */
  getSettings(): Promise<MapSettings | null>;

  /** Create or update map settings. */
  updateSettings(data: UpdateMapSettingsInput): Promise<MapSettings>;

  /** Create a new node. */
  createNode(data: CreateMapNodeInput): Promise<MapNode>;

  /** Create a new edge. */
  createEdge(data: CreateMapEdgeInput): Promise<MapEdge>;

  /** Find node by ID. */
  findNodeById(nodeId: string): Promise<MapNode | null>;

  /** Find edge by ID. */
  findEdgeById(edgeId: string): Promise<MapEdge | null>;

  /** Update a node. */
  updateNode(nodeId: string, data: UpdateMapNodeInput): Promise<MapNode>;

  /** Update an edge. */
  updateEdge(edgeId: string, data: UpdateMapEdgeInput): Promise<MapEdge>;

  /** Delete a node and its connected edges. */
  deleteNode(nodeId: string): Promise<MapNode>;

  /** Delete an edge. */
  deleteEdge(edgeId: string): Promise<MapEdge>;

  /** Count outgoing edges from node. */
  countEdgesFromSource(sourceNodeId: string): Promise<number>;

  /** Replace all map data with synced payload. */
  syncAllMappingData(data: SyncMapDataInput): Promise<void>;

  /** Delete all mapping data. */
  resetAllMappingData(): Promise<void>;
}
