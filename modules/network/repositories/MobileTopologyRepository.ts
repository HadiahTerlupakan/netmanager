import { prisma } from "@/modules/database";
import type { IMobileTopologyRepository } from "../domain/ports/IMobileTopologyRepository";
import {
  KMZ_FILE_SELECT,
  PELANGGAN_SELECT,
  TOPOLOGY_BASE_SELECT,
} from "./mobileTopology.selects";

export class MobileTopologyRepository implements IMobileTopologyRepository {
  /** Get raw topology records for mobile topology view. */
  async getTopologyData(tenantId: string) {
    const [otbs, pelanggans, kmzFiles, mappingNodes, mappingEdges, edgeCounts] =
      await Promise.all([
        this.findOtbs(tenantId),
        this.findPelanggans(tenantId),
        this.findKmzFiles(tenantId),
        prisma.mappingNode.findMany(),
        prisma.mappingEdge.findMany(),
        prisma.mappingEdge.groupBy({
          by: ["source"],
          _count: { source: true },
        }),
      ]);

    return {
      otbs,
      // Tabel `Odc`, `Odp`, `Joinbox`, dan `Pole` tidak pernah ditulis oleh apa
      // pun di aplikasi ini — tidak ada endpoint, UI, seed, maupun migration
      // yang mengisinya, dan repository-nya nol pemanggil. Empat query ke tabel
      // itu selalu mengembalikan nol baris di setiap permintaan.
      //
      // Data topologi yang sebenarnya sudah dikirim lewat `mappingNodes` dan
      // `mappingEdges` di bawah: di produksi 457 node (426 ODP, 31 ODC) sampai
      // ke aplikasi mobile melalui jalur itu. Kunci-kunci ini dipertahankan
      // agar bentuk respons tidak berubah bagi aplikasi mobile.
      odcs: [] as Record<string, unknown>[],
      odps: [] as Record<string, unknown>[],
      joinboxes: [] as Record<string, unknown>[],
      poles: [] as Record<string, unknown>[],
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
