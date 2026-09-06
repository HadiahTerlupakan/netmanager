import { describe, expect, it, vi } from "vitest";
import { MobileTopologyService } from "@/modules/network/services/MobileTopologyService";
import type { MobileTopologyEntity } from "@/modules/network/domain/entities/MobileTopologyEntity";

vi.mock("@/modules/settings", () => ({
  getR2Settings: async (): Promise<null> => null,
}));

/**
 * Endpoint topologi mobile dulu menjalankan empat query tambahan ke tabel
 * `Odc`, `Odp`, `Joinbox`, dan `Pole` di setiap permintaan. Tabel-tabel itu
 * tidak pernah ditulis oleh apa pun di aplikasi ini, jadi keempatnya selalu
 * mengembalikan nol baris.
 *
 * Topologi yang sebenarnya sampai ke aplikasi mobile lewat `nodes` dan
 * `edges`, yang bersumber dari `mapping_nodes` — tempat ODP dan ODC benar-benar
 * dibuat. Kunci lama tetap ada di respons supaya bentuknya tidak berubah bagi
 * aplikasi mobile yang sudah beredar.
 */
const emptyTopology = (
  over: Partial<MobileTopologyEntity> = {},
): MobileTopologyEntity => ({
  otbs: [],
  odcs: [],
  odps: [],
  joinboxes: [],
  poles: [],
  pelanggans: [],
  kmzFiles: [],
  mappingNodes: [],
  mappingEdges: [],
  edgeCounts: [],
  ...over,
});

const node = (nodeId: string, type: string) =>
  ({
    nodeId,
    name: nodeId,
    type,
    photo: null,
    splitter: null,
    capacity: 8,
    inputCoreColor: null,
    attenuationIn: null,
    attenuationOut: null,
  }) as unknown as MobileTopologyEntity["mappingNodes"][number];

function buildService(topology: MobileTopologyEntity) {
  return new MobileTopologyService({
    getTopologyData: async () => topology,
  } as never);
}

describe("MobileTopologyService — topologi dari node peta", () => {
  it("mengirim node peta lewat `nodes`, bukan lewat array lama", async () => {
    const service = buildService(
      emptyTopology({
        mappingNodes: [node("odp-1", "odp"), node("odc-1", "odc")],
      }),
    );

    const result = await service.getTopology("tenant-1");

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.type)).toEqual(["odp", "odc"]);
  });

  // Menghapus kunci ini akan membuat aplikasi mobile yang memanggil
  // `response.odps.map(...)` gagal, jadi bentuk respons dipertahankan.
  it("mempertahankan kunci lama sebagai array kosong", async () => {
    const service = buildService(emptyTopology());

    const result = await service.getTopology("tenant-1");

    expect(result.odcs).toEqual([]);
    expect(result.odps).toEqual([]);
    expect(result.joinboxes).toEqual([]);
    expect(result.poles).toEqual([]);
  });
});
