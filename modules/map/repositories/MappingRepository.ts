import { prisma } from "@/lib/prisma";
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
import { SETTINGS_ORDER_DIRECTION } from "../utils/mapConstants";
import {
  createManyMappingEdges,
  createManyMappingNodes,
  toEdgeCreateData,
  toEdgeUpdateData,
  toNodeCreateData,
  toNodeUpdateData,
} from "./mapping-repository.helpers";

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
      data: toNodeCreateData(data),
    });

    return MapMapper.toDomainNode(record);
  }

  /** Create a new edge. */
  async createEdge(data: CreateMapEdgeInput) {
    const record = await prisma.mappingEdge.create({
      data: toEdgeCreateData(data),
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
      data: toNodeUpdateData(data),
    });

    return MapMapper.toDomainNode(record);
  }

  /** Update an edge. */
  async updateEdge(edgeId: string, data: UpdateMapEdgeInput) {
    const record = await prisma.mappingEdge.update({
      where: { edgeId },
      data: toEdgeUpdateData(data),
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

      await createManyMappingNodes(transaction, data.nodes);
      await createManyMappingEdges(transaction, data.edges);
    });
  }

  /** Delete all mapping data. */
  async resetAllMappingData() {
    await prisma.$transaction(async (transaction) => {
      await transaction.mappingEdge.deleteMany({});
      await transaction.mappingNode.deleteMany({});
    });
  }
}
