import { prisma } from "@/modules/database";
import type { IMobileTopologyRepository } from "../domain/ports/IMobileTopologyRepository";
import {
  KMZ_FILE_SELECT,
  ODC_SELECT,
  ODP_SELECT,
  PELANGGAN_SELECT,
  POLE_SELECT,
  TOPOLOGY_BASE_SELECT,
} from "./mobileTopology.selects";

export class MobileTopologyRepository implements IMobileTopologyRepository {
  /** Get raw topology records for mobile topology view. */
  async getTopologyData(tenantId: string) {
    const [
      otbs,
      odcs,
      odps,
      joinboxes,
      poles,
      pelanggans,
      kmzFiles,
      mappingNodes,
      mappingEdges,
      edgeCounts,
    ] = await Promise.all([
      this.findOtbs(tenantId),
      this.findOdcs(tenantId),
      this.findOdps(tenantId),
      this.findJoinboxes(tenantId),
      this.findPoles(tenantId),
      this.findPelanggans(tenantId),
      this.findKmzFiles(tenantId),
      prisma.mappingNode.findMany(),
      prisma.mappingEdge.findMany(),
      prisma.mappingEdge.groupBy({ by: ["source"], _count: { source: true } }),
    ]);

    return {
      otbs,
      odcs,
      odps,
      joinboxes,
      poles,
      pelanggans,
      kmzFiles,
      mappingNodes,
      mappingEdges,
      edgeCounts,
    };
  }

  /** Ambil data OTB yang memiliki koordinat. */
  private findOtbs(tenantId: string) {
    return prisma.otb.findMany({
      where: this.withCoordinates(tenantId),
      select: TOPOLOGY_BASE_SELECT,
    });
  }

  /** Ambil data ODC yang memiliki koordinat. */
  private findOdcs(tenantId: string) {
    return prisma.odc.findMany({
      where: this.withCoordinates(tenantId),
      select: ODC_SELECT,
    });
  }

  /** Ambil data ODP yang memiliki koordinat. */
  private findOdps(tenantId: string) {
    return prisma.odp.findMany({
      where: this.withCoordinates(tenantId),
      select: ODP_SELECT,
    });
  }

  /** Ambil data joinbox yang memiliki koordinat. */
  private findJoinboxes(tenantId: string) {
    return prisma.joinbox.findMany({
      where: this.withCoordinates(tenantId),
      select: TOPOLOGY_BASE_SELECT,
    });
  }

  /** Ambil data tiang yang memiliki koordinat. */
  private findPoles(tenantId: string) {
    return prisma.pole.findMany({
      where: this.withCoordinates(tenantId),
      select: POLE_SELECT,
    });
  }

  /** Ambil data pelanggan yang tersambung ke ODP. */
  private findPelanggans(tenantId: string) {
    return prisma.pelanggan.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        odpId: { not: null },
        tenantId,
      },
      select: PELANGGAN_SELECT,
    });
  }

  /** Ambil file KMZ aktif untuk tenant. */
  private findKmzFiles(tenantId: string) {
    return prisma.kmzFile.findMany({
      where: { isActive: true, tenantId },
      select: KMZ_FILE_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Bangun where clause untuk entitas berkoordinat. */
  private withCoordinates(tenantId: string): {
    latitude: { not: null };
    longitude: { not: null };
    tenantId: string;
  } {
    return { latitude: { not: null }, longitude: { not: null }, tenantId };
  }
}
