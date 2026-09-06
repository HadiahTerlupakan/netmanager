import { describe, expect, it, vi } from "vitest";
import { MappingService } from "@/modules/map/services/MappingService";
import type { IMappingRepository } from "@/modules/map/domain/ports/IMappingRepository";
import type { MapNode } from "@/modules/map/domain/entities/MapNode";
import type { TenantContext } from "@/modules/map/utils/tenantContext";
import type { MapListFilters } from "@/modules/map/types/MappingRepositoryTypes";

/**
 * Dropdown ODP pada form pelanggan sebelumnya membaca tabel `Odp`, yang tidak
 * pernah ditulis oleh apa pun di aplikasi ini — bukan oleh kode, seed, maupun
 * migration. ODP yang benar-benar dipakai dibuat lewat halaman Topology Map dan
 * import CSV, dan keduanya menulis ke `mapping_nodes`. Akibatnya dropdown itu
 * selalu kosong: di produksi ada 426 ODP di peta dan 0 baris di tabel `Odp`.
 */

const ctx: TenantContext = { tenantId: "tenant-1", isSuperAdmin: false };

const node = (over: Partial<MapNode>): MapNode => ({
  nodeId: "odp-1",
  type: "odp",
  name: "ODP-001",
  latitude: null,
  longitude: null,
  capacity: 8,
  splitter: null,
  pppoe: null,
  serialNumber: null,
  notes: null,
  createdAt: new Date("2026-09-06T00:00:00.000Z"),
  updatedAt: new Date("2026-09-06T00:00:00.000Z"),
  attenuationIn: null,
  attenuationOut: null,
  inputCoreColor: null,
  photo: null,
  metadata: null,
  tenantId: "tenant-1",
  siteId: null,
  ...over,
});

function buildService(nodes: MapNode[]) {
  const findAllNodes =
    vi.fn<
      (ctx: TenantContext, filters?: MapListFilters) => Promise<MapNode[]>
    >();
  findAllNodes.mockResolvedValue(nodes);

  const repository = { findAllNodes } as unknown as IMappingRepository;

  return { service: new MappingService(repository), findAllNodes };
}

describe("MappingService.getOdpOptions", () => {
  it("mengambil ODP dari node peta, bukan dari tabel Odp", async () => {
    const { service } = buildService([
      node({ nodeId: "odp-ODP-BLJ-01", name: "ODP-BLJ-01" }),
    ]);

    const options = await service.getOdpOptions(ctx);

    expect(options).toEqual([{ id: "odp-ODP-BLJ-01", name: "ODP-BLJ-01" }]);
  });

  // Penyaringan tipe harus terjadi di SQL. Menarik seluruh node lalu menyaring
  // di memori berarti ratusan baris ODC/ONT ikut terambil setiap kali form
  // pelanggan dibuka.
  it("menyaring tipe odp lewat filter repository, bukan di memori", async () => {
    const { service, findAllNodes } = buildService([]);

    await service.getOdpOptions(ctx, { siteId: "site-1" });

    expect(findAllNodes).toHaveBeenCalledWith(ctx, {
      siteId: "site-1",
      type: "odp",
      includeUnassignedSite: true,
    });
  });

  // Sinkronisasi peta (`createManyMappingNodes`) dan import CSV tidak pernah
  // mengisi `siteId`; di produksi seluruh 426 ODP ber-siteId null. Form
  // pelanggan wajib memilih site, jadi filter ketat akan mengosongkan dropdown
  // justru untuk data yang paling banyak dipakai.
  it("tetap menyertakan ODP tanpa site saat difilter per site", async () => {
    const { service, findAllNodes } = buildService([]);

    await service.getOdpOptions(ctx, { siteId: "site-1" });

    expect(findAllNodes).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ includeUnassignedSite: true }),
    );
  });

  it("meneruskan konteks tenant apa adanya ke repository", async () => {
    const superAdminCtx: TenantContext = {
      tenantId: null,
      isSuperAdmin: true,
    };
    const { service, findAllNodes } = buildService([]);

    await service.getOdpOptions(superAdminCtx);

    expect(findAllNodes).toHaveBeenCalledWith(superAdminCtx, {
      type: "odp",
      includeUnassignedSite: true,
    });
  });

  // Node peta boleh tanpa nama; opsi tanpa label tidak bisa dipilih pengguna.
  it("memakai nodeId sebagai nama saat node tidak bernama", async () => {
    const { service } = buildService([
      node({ nodeId: "odp-tanpa-nama", name: null }),
    ]);

    const options = await service.getOdpOptions(ctx);

    expect(options).toEqual([{ id: "odp-tanpa-nama", name: "odp-tanpa-nama" }]);
  });

  it("mengurutkan opsi berdasarkan nama", async () => {
    const { service } = buildService([
      node({ nodeId: "n3", name: "ODP-C" }),
      node({ nodeId: "n1", name: "ODP-A" }),
      node({ nodeId: "n2", name: "ODP-B" }),
    ]);

    const options = await service.getOdpOptions(ctx);

    expect(options.map((option) => option.name)).toEqual([
      "ODP-A",
      "ODP-B",
      "ODP-C",
    ]);
  });
});
