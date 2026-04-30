import { Prisma } from "@prisma/client";
import type {
  CreateMapEdgeInput,
  CreateMapNodeInput,
  SyncMapDataInput,
  UpdateMapEdgeInput,
  UpdateMapNodeInput,
} from "../types/MappingRepositoryTypes";
import {
  DEFAULT_EDGE_FIBER_TYPE,
  DEFAULT_NODE_CAPACITY,
  DEFAULT_SYNC_NODE_CAPACITY,
} from "../utils/mapConstants";

export type MappingTransactionClient = Prisma.TransactionClient;

export function toNodeCreateData(
  data: CreateMapNodeInput,
): Prisma.MappingNodeUncheckedCreateInput {
  return {
    nodeId: data.nodeId,
    type: data.type,
    name: data.name ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    capacity: data.capacity ?? DEFAULT_NODE_CAPACITY,
    splitter: data.splitter ?? null,
    pppoe: data.pppoe ?? null,
    serialNumber: data.serialNumber ?? null,
    notes: data.notes ?? null,
    attenuationIn: data.attenuationIn ?? null,
    attenuationOut: data.attenuationOut ?? null,
    inputCoreColor: data.inputCoreColor ?? null,
    photo: data.photo ?? null,
    metadata: toPrismaMetadata(data.metadata),
    tenantId: data.tenantId ?? null,
  };
}

export function toNodeUpdateData(
  data: UpdateMapNodeInput,
): Prisma.MappingNodeUncheckedUpdateInput {
  return {
    type: data.type,
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    capacity: data.capacity,
    splitter: data.splitter,
    pppoe: data.pppoe,
    serialNumber: data.serialNumber,
    notes: data.notes,
    attenuationIn: data.attenuationIn,
    attenuationOut: data.attenuationOut,
    inputCoreColor: data.inputCoreColor,
    photo: data.photo,
    metadata: toPrismaMetadata(data.metadata),
    tenantId: data.tenantId ?? undefined,
  };
}

export function toEdgeCreateData(
  data: CreateMapEdgeInput,
): Prisma.MappingEdgeUncheckedCreateInput {
  return {
    edgeId: data.edgeId,
    source: data.source,
    target: data.target,
    fiberType: data.fiberType ?? DEFAULT_EDGE_FIBER_TYPE,
    distance: data.distance ?? null,
    waypoints: data.waypoints ?? null,
    notes: data.notes ?? null,
    name: data.name ?? null,
    tenantId: data.tenantId ?? null,
  };
}

export function toEdgeUpdateData(
  data: UpdateMapEdgeInput,
): Prisma.MappingEdgeUncheckedUpdateInput {
  return {
    source: data.source,
    target: data.target,
    fiberType: data.fiberType,
    distance: data.distance,
    waypoints: data.waypoints,
    notes: data.notes,
    name: data.name,
    tenantId: data.tenantId ?? undefined,
  };
}

export function toPrismaMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;
}

export async function createManyMappingNodes(
  transaction: MappingTransactionClient,
  nodes: SyncMapDataInput["nodes"],
) {
  if (nodes.length === 0) return;
  await transaction.mappingNode.createMany({
    data: nodes.map((node) => ({
      nodeId: node.nodeId,
      type: node.type === "server" ? "olt" : node.type,
      name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      capacity: node.capacity ?? DEFAULT_SYNC_NODE_CAPACITY,
      splitter: node.splitter ?? null,
      pppoe: node.pppoe ?? null,
      serialNumber: node.serialNumber ?? null,
      notes: node.notes ?? null,
    })),
  });
}

export async function createManyMappingEdges(
  transaction: MappingTransactionClient,
  edges: SyncMapDataInput["edges"],
) {
  if (edges.length === 0) return;
  await transaction.mappingEdge.createMany({
    data: edges.map((edge) => ({
      edgeId: edge.edgeId,
      source: edge.source,
      target: edge.target,
      fiberType: edge.fiberType ?? DEFAULT_EDGE_FIBER_TYPE,
      distance: edge.distance ?? null,
      waypoints: edge.waypoints ?? null,
      notes: edge.notes ?? null,
    })),
  });
}
