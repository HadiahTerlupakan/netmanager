import bcrypt from "bcryptjs";
import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import { MappingService } from "./MappingService";

interface SyncNodeInput {
  nodeId: string;
  type: "server" | "olt" | "odc" | "odp" | "ont";
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  splitter?: string | null;
  pppoe?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
}

interface SyncEdgeInput {
  edgeId: string;
  source: string;
  target: string;
  fiberType?:
    | "feeder"
    | "distribution"
    | "drop"
    | "odp_to_odp"
    | "odp_to_odp_ratio"
    | "odc_to_odc"
    | "odc_to_odc_ratio";
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
}

export class MappingAdminService {
  private mappingService: MappingService;

  constructor() {
    this.mappingService = new MappingService();
  }

  async verifyResetPassword(email: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return false;
    }

    return bcrypt.compare(password, user.passwordHash);
  }

  async resetAllMappingData(): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.mappingEdge.deleteMany({});
      await tx.mappingNode.deleteMany({});
    });
  }

  async syncAllMappingData(
    nodes: SyncNodeInput[],
    edges: SyncEdgeInput[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.mappingEdge.deleteMany({});
      await tx.mappingNode.deleteMany({});

      if (nodes.length > 0) {
        await tx.mappingNode.createMany({
          data: nodes.map((node) => ({
            nodeId: node.nodeId,
            type: node.type === "server" ? "olt" : node.type,
            name: node.name,
            latitude: node.latitude,
            longitude: node.longitude,
            capacity: node.capacity || 8,
            splitter: node.splitter || null,
            pppoe: node.pppoe || null,
            serialNumber: node.serialNumber || null,
            notes: node.notes || null,
          })),
        });
      }

      if (edges.length > 0) {
        await tx.mappingEdge.createMany({
          data: edges.map((edge) => ({
            edgeId: edge.edgeId,
            source: edge.source,
            target: edge.target,
            fiberType: edge.fiberType || "distribution",
            distance: edge.distance || null,
            waypoints: edge.waypoints || null,
            notes: edge.notes || null,
          })),
        });
      }
    });
  }

  async createNode(data: Prisma.MappingNodeCreateInput) {
    return this.mappingService.createNode(data);
  }
}

let mappingAdminServiceInstance: MappingAdminService | null = null;

export function getMappingAdminService(): MappingAdminService {
  if (!mappingAdminServiceInstance) {
    mappingAdminServiceInstance = new MappingAdminService();
  }

  return mappingAdminServiceInstance;
}
