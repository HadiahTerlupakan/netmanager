import { createHandler, apiSuccess } from "@/lib/api";
import { buildTenantContext, getMappingService } from "@/modules/map";

export const dynamic = "force-dynamic";

const mappingService = getMappingService();

/**
 * Ambil daftar ODP untuk kebutuhan dropdown pemilihan ODP pelanggan.
 *
 * Sumbernya `mapping_nodes` (type = "odp") — tempat ODP benar-benar dibuat,
 * lewat halaman Topology Map dan import CSV. Sebelumnya endpoint ini membaca
 * tabel `Odp`, yang tidak pernah ditulis oleh apa pun di aplikasi ini,
 * sehingga dropdown ODP di form pelanggan selalu kosong.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId") || undefined;

  const odps = await mappingService.getOdpOptions(
    buildTenantContext(ctx.session?.user),
    { siteId },
  );

  return apiSuccess({ odps });
});
