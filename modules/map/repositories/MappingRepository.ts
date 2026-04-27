import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import { MapMapper } from "../mappers/MapMapper";
import type {
  CreateMapEdgeInput,
  CreateMapNodeInput,
  SyncMapDataInput,
  UpdateMapEdgeInput,
  UpdateMapNodeInput,
  UpdateMapSettingsInput,
} from "../types/MappingRepositoryTypes";
import {
  DEFAULT_EDGE_FIBER_TYPE,
  DEFAULT_NODE_CAPACITY,
  DEFAULT_SYNC_NODE_CAPACITY,
  SETTINGS_ORDER_DIRECTION,
} from "../utils/mapConstants";

type MappingTransactionClient = Prisma.TransactionClient;

export class MappingRepository implements IMappingRepository {
  /** Get all mapping nodes. */
  async findAllNodes() {
    const records = await prisma.mappingNode.findMany();
    return records.map((record) => MapMapper.toDomainNode(record));
  }

  /** Get all mapping edges. */
  async findAllEdges() {
    const records = await prisma.mappingEdge.findMany({
      include: {
        sourceNode: { select: { name: true } },
        targetNode: { select: { name: true } },
      },
    });

    return records.map((record) => MapMapper.toDomainEdge(record));
  }

  /** Get latest map settings. */
  async getSettings() {
    const record = await prisma.mapSettings.findFirst({
      orderBy: { updatedAt: SETTINGS_ORDER_DIRECTION },
    });

    return record ? MapMapper.toDomainSettings(record) : null;
  }

  /** Create or update map settings. */
  async updateSettings(data: UpdateMapSettingsInput) {
    const existingSettings = await prisma.mapSettings.findFirst({
      orderBy: { updatedAt: SETTINGS_ORDER_DIRECTION },
    });

    const record = existingSettings
      ? await prisma.mapSettings.update({
          where: { id: existingSettings.id },
          data,
        })
      : await prisma.mapSettings.create({ data });

    return MapMapper.toDomainSettings(record);
  }

  /** Create a new node. */
  async createNode(data: CreateMapNodeInput) {
    const record = await prisma.mappingNode.create({
      data: this.toNodeCreateData(data),
    });

    return MapMapper.toDomainNode(record);
  }

  /** Create a new edge. */
  async createEdge(data: CreateMapEdgeInput) {
    const record = await prisma.mappingEdge.create({
      data: this.toEdgeCreateData(data),
      include: {
        sourceNode: { select: { name: true } },
        targetNode: { select: { name: true } },
      },
    });

    return MapMapper.toDomainEdge(record);
  }

  /** Find node by ID. */
  async findNodeById(nodeId: string) {
    const record = await prisma.mappingNode.findUnique({
      where: { nodeId },
    });

    return record ? MapMapper.toDomainNode(record) : null;
  }

  /** Find edge by ID. */
  async findEdgeById(edgeId: string) {
    const record = await prisma.mappingEdge.findUnique({
      where: { edgeId },
      include: {
        sourceNode: { select: { name: true } },
        targetNode: { select: { name: true } },
      },
    });

    return record ? MapMapper.toDomainEdge(record) : null;
  }

  /** Update a node. */
  async updateNode(nodeId: string, data: UpdateMapNodeInput) {
    const record = await prisma.mappingNode.update({
      where: { nodeId },
      data: this.toNodeUpdateData(data),
    });

    return MapMapper.toDomainNode(record);
  }

  /** Update an edge. */
  async updateEdge(edgeId: string, data: UpdateMapEdgeInput) {
    const record = await prisma.mappingEdge.update({
      where: { edgeId },
      data: this.toEdgeUpdateData(data),
      include: {
        sourceNode: { select: { name: true } },
        targetNode: { select: { name: true } },
      },
    });

    return MapMapper.toDomainEdge(record);
  }

  /** Delete a node and its connected edges. */
  async deleteNode(nodeId: string) {
    await prisma.mappingEdge.deleteMany({
      where: {
        OR: [{ source: nodeId }, { target: nodeId }],
      },
    });

    const record = await prisma.mappingNode.delete({
      where: { nodeId },
    });

    return MapMapper.toDomainNode(record);
  }

  /** Delete an edge. */
  async deleteEdge(edgeId: string) {
    const record = await prisma.mappingEdge.delete({
      where: { edgeId },
      include: {
        sourceNode: { select: { name: true } },
        targetNode: { select: { name: true } },
      },
    });

    return MapMapper.toDomainEdge(record);
  }

  /** Count outgoing edges from node. */
  async countEdgesFromSource(sourceNodeId: string) {
    return prisma.mappingEdge.count({
      where: { source: sourceNodeId },
    });
  }

  /** Replace all map data with synced payload. */
  async syncAllMappingData(data: SyncMapDataInput) {
    await prisma.$transaction(async (transaction) => {
      await transaction.mappingEdge.deleteMany({});
      await transaction.mappingNode.deleteMany({});

      await this.createManyNodes(transaction, data.nodes);
      await this.createManyEdges(transaction, data.edges);
    });
  }

  /** Delete all mapping data. */
  async resetAllMappingData() {
    await prisma.$transaction(async (transaction) => {
      await transaction.mappingEdge.deleteMany({});
      await transaction.mappingNode.deleteMany({});
    });
  }

  /** Convert node input to Prisma create payload. */
  private toNodeCreateData(
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
      metadata: this.toPrismaMetadata(data.metadata),
      tenantId: data.tenantId ?? null,
    };
  }

  /** Convert node input to Prisma update payload. */
  private toNodeUpdateData(
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
      metadata: this.toPrismaMetadata(data.metadata),
      tenantId: data.tenantId ?? undefined,
    };
  }

  /** Convert edge input to Prisma create payload. */
  private toEdgeCreateData(
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

  /** Convert edge input to Prisma update payload. */
  private toEdgeUpdateData(
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

  /** Convert metadata object to Prisma JSON input. */
  private toPrismaMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (!metadata) {
      return Prisma.JsonNull;
    }

    return metadata as Prisma.InputJsonValue;
  }

  /** Bulk insert synced nodes when payload is not empty. */
  private async createManyNodes(
    transaction: MappingTransactionClient,
    nodes: SyncMapDataInput["nodes"],
  ) {
    if (nodes.length === 0) {
      return;
    }

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

  /** Bulk insert synced edges when payload is not empty. */
  private async createManyEdges(
    transaction: MappingTransactionClient,
    edges: SyncMapDataInput["edges"],
  ) {
    if (edges.length === 0) {
      return;
    }

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
}
