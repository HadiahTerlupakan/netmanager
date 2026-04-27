import { prisma } from "@/modules/database";
import type { IMobileTopologyRepository } from "../domain/ports/IMobileTopologyRepository";

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
      prisma.otb.findMany({
        where: this.withCoordinates(tenantId),
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
        },
      }),
      prisma.odc.findMany({
        where: this.withCoordinates(tenantId),
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          attenuationIn: true,
          attenuationOut: true,
          inputCoreColor: true,
          otbCore: {
            select: {
              coreColor: true,
              tubeColor: true,
              otb: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      }),
      prisma.odp.findMany({
        where: this.withCoordinates(tenantId),
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          attenuationIn: true,
          attenuationOut: true,
          inputCoreColor: true,
          odcOutput: {
            select: {
              coreColor: true,
              tubeColor: true,
              odc: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
          _count: { select: { odpOutput: true } },
          site: { select: { name: true } },
        },
      }),
      prisma.joinbox.findMany({
        where: this.withCoordinates(tenantId),
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
        },
      }),
      prisma.pole.findMany({
        where: this.withCoordinates(tenantId),
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          cableSlack: true,
        },
      }),
      prisma.pelanggan.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          odpId: { not: null },
          tenantId,
        },
        select: {
          id: true,
          idPelanggan: true,
          nama: true,
          latitude: true,
          longitude: true,
          alamat: true,
          status: true,
          odpId: true,
          odp: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      }),
      prisma.kmzFile.findMany({
        where: { isActive: true, tenantId },
        select: {
          id: true,
          name: true,
          kmlPath: true,
          lineColor: true,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      }),
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

  private withCoordinates(tenantId: string): {
    latitude: { not: null };
    longitude: { not: null };
    tenantId: string;
  } {
    return { latitude: { not: null }, longitude: { not: null }, tenantId };
  }
}
