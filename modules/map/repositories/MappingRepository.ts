import { prisma } from "@/lib/prisma";
import { NotFoundError as MapNotFoundError } from "@/lib/errors";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import type { TenantContext } from "../domain/tenantContext";
import { buildTenantWhere } from "../domain/tenantContext";
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

const EDGE_INCLUDE = {
  sourceNode: { select: { name: true } },
  targetNode: { select: { name: true } },
} as const;

export class MappingRepository implements IMappingRepository {
  async findAllNodes(ctx: TenantContext) {
    const records = await prisma.mappingNode.findMany({
      where: buildTenantWhere(ctx),
    });
    return records.map((record) => MapMapper.toDomainNode(record));
  }

  async findAllEdges(ctx: TenantContext) {
    const records = await prisma.mappingEdge.findMany({
      where: buildTenantWhere(ctx),
      include: EDGE_INCLUDE,
    });
    return records.map((record) => MapMapper.toDomainEdge(record));
  }

  async getSettings(ctx: TenantContext) {
    const record = await prisma.mapSettings.findFirst({
      where: buildTenantWhere(ctx),
      orderBy: { updatedAt: SETTINGS_ORDER_DIRECTION },
    });
    return record ? MapMapper.toDomainSettings(record) : null;
  }

  async updateSettings(ctx: TenantContext, data: UpdateMapSettingsInput) {
    const where = buildTenantWhere(ctx);
    const existing = await prisma.mapSettings.findFirst({
      where,
      orderBy: { updatedAt: SETTINGS_ORDER_DIRECTION },
    });

    const record = existing
      ? await prisma.mapSettings.update({ where: { id: existing.id }, data })
      : await prisma.mapSettings.create({
          data: { ...data, tenantId: ctx.tenantId ?? null },
        });
    return MapMapper.toDomainSettings(record);
  }

  async createNode(ctx: TenantContext, data: CreateMapNodeInput) {
    const record = await prisma.mappingNode.create({
      data: { ...toNodeCreateData(data), tenantId: ctx.tenantId ?? null },
    });
    return MapMapper.toDomainNode(record);
  }

  async createEdge(ctx: TenantContext, data: CreateMapEdgeInput) {
    const record = await prisma.mappingEdge.create({
      data: { ...toEdgeCreateData(data), tenantId: ctx.tenantId ?? null },
      include: EDGE_INCLUDE,
    });
    return MapMapper.toDomainEdge(record);
  }

  async findNodeById(ctx: TenantContext, nodeId: string) {
    const record = await prisma.mappingNode.findFirst({
      where: { nodeId, ...buildTenantWhere(ctx) },
    });
    return record ? MapMapper.toDomainNode(record) : null;
  }

  async findEdgeById(ctx: TenantContext, edgeId: string) {
    const record = await prisma.mappingEdge.findFirst({
      where: { edgeId, ...buildTenantWhere(ctx) },
      include: EDGE_INCLUDE,
    });
    return record ? MapMapper.toDomainEdge(record) : null;
  }

  async findEdgesByNode(ctx: TenantContext, nodeId: string) {
    const records = await prisma.mappingEdge.findMany({
      where: {
        OR: [{ source: nodeId }, { target: nodeId }],
        ...buildTenantWhere(ctx),
      },
      include: EDGE_INCLUDE,
    });
    return records.map((record) => MapMapper.toDomainEdge(record));
  }

  async updateNode(
    ctx: TenantContext,
    nodeId: string,
    data: UpdateMapNodeInput,
  ) {
    const result = await prisma.mappingNode.updateMany({
      where: { nodeId, ...buildTenantWhere(ctx) },
      data: toNodeUpdateData(data),
    });
    if (result.count === 0) throw new MapNotFoundError("Node");
    const record = await prisma.mappingNode.findUniqueOrThrow({
      where: { nodeId },
    });
    return MapMapper.toDomainNode(record);
  }

  async updateEdge(
    ctx: TenantContext,
    edgeId: string,
    data: UpdateMapEdgeInput,
  ) {
    const result = await prisma.mappingEdge.updateMany({
      where: { edgeId, ...buildTenantWhere(ctx) },
      data: toEdgeUpdateData(data),
    });
    if (result.count === 0) throw new MapNotFoundError("Edge");
    const record = await prisma.mappingEdge.findUniqueOrThrow({
      where: { edgeId },
      include: EDGE_INCLUDE,
    });
    return MapMapper.toDomainEdge(record);
  }

  async deleteNode(ctx: TenantContext, nodeId: string) {
    const owned = await this.findNodeById(ctx, nodeId);
    if (!owned) throw new MapNotFoundError("Node");

    await prisma.mappingEdge.deleteMany({
      where: {
        OR: [{ source: nodeId }, { target: nodeId }],
        ...buildTenantWhere(ctx),
      },
    });
    const result = await prisma.mappingNode.deleteMany({
      where: { nodeId, ...buildTenantWhere(ctx) },
    });
    if (result.count === 0) throw new MapNotFoundError("Node");
    return MapMapper.toDomainNode(owned);
  }

  async deleteEdge(ctx: TenantContext, edgeId: string) {
    const owned = await this.findEdgeById(ctx, edgeId);
    if (!owned) throw new MapNotFoundError("Edge");

    const result = await prisma.mappingEdge.deleteMany({
      where: { edgeId, ...buildTenantWhere(ctx) },
    });
    if (result.count === 0) throw new MapNotFoundError("Edge");
    return MapMapper.toDomainEdge(owned);
  }

  async countEdgesFromSource(ctx: TenantContext, sourceNodeId: string) {
    return prisma.mappingEdge.count({
      where: { source: sourceNodeId, ...buildTenantWhere(ctx) },
    });
  }

  async syncAllMappingData(ctx: TenantContext, data: SyncMapDataInput) {
    await prisma.$transaction(async (transaction) => {
      await transaction.mappingEdge.deleteMany({
        where: buildTenantWhere(ctx),
      });
      await transaction.mappingNode.deleteMany({
        where: buildTenantWhere(ctx),
      });
      await createManyMappingNodes(transaction, data.nodes, ctx.tenantId);
      await createManyMappingEdges(transaction, data.edges, ctx.tenantId);
    });
  }

  async resetAllMappingData(ctx: TenantContext) {
    await prisma.$transaction(async (transaction) => {
      await transaction.mappingEdge.deleteMany({
        where: buildTenantWhere(ctx),
      });
      await transaction.mappingNode.deleteMany({
        where: buildTenantWhere(ctx),
      });
    });
  }
}
