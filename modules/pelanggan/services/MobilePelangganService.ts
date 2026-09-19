import type { Session } from "next-auth";
import type { Prisma, Status } from "@prisma/client";
import { checkSiteRestriction } from "@/modules/roles";
import { PelangganRepository } from "../repositories/PelangganRepository";

export class SiteAccessDeniedError extends Error {}

export interface MobilePelangganDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: Status;
  paket: string | null;
  alamat: string | null;
  noTelp: string | null;
  jatuhTempo: string;
  siteId: string | null;
  siteName: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ListInput {
  session: Session;
  status?: Status | null;
  search?: string | null;
  siteId?: string | null;
  page: number;
  limit: number;
}

const repository = new PelangganRepository();

/** Pelanggan yang sudah dibongkar tidak relevan untuk layar mobile. */
const EXCLUDE_DISMANTLE = { not: "DISMANTLE" } as Prisma.EnumStatusFilter;

/** Filter site untuk sesi mobile; melempar bila site yang diminta di luar hak akses. */
function resolveSiteFilter(
  session: Session,
  requestedSiteId?: string | null,
): Prisma.StringNullableFilter | string | undefined {
  const restriction = checkSiteRestriction(session as never, "pelanggan");

  if (!restriction.isRestricted) {
    return requestedSiteId ?? undefined;
  }
  if (restriction.siteIds.length === 0) {
    throw new SiteAccessDeniedError("User tidak memiliki akses site");
  }
  if (!requestedSiteId) {
    return { in: restriction.siteIds };
  }
  if (!restriction.siteIds.includes(requestedSiteId)) {
    throw new SiteAccessDeniedError("Site tidak diizinkan untuk user ini");
  }
  return requestedSiteId;
}

function toDTO(
  row: Awaited<
    ReturnType<PelangganRepository["findAllPaginated"]>
  >["data"][number],
): MobilePelangganDTO {
  return {
    id: row.id,
    idPelanggan: row.idPelanggan,
    nama: row.nama,
    username: row.username,
    status: row.status,
    paket: row.hargaPaket?.name ?? null,
    alamat: row.alamat ?? null,
    noTelp: row.noTelp ?? null,
    jatuhTempo: new Date(row.jatuhTempo).toISOString(),
    siteId: row.siteId ?? null,
    siteName: row.site?.name ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

/** Daftar pelanggan untuk aplikasi mobile, dibatasi tenant dan site karyawan. */
export async function listMobilePelanggan(
  input: ListInput,
): Promise<{ data: MobilePelangganDTO[]; total: number }> {
  const siteId = resolveSiteFilter(input.session, input.siteId);
  const { data, total } = await repository.findAllPaginated(
    {
      ...(siteId ? { siteId } : {}),
      ...(input.search ? { search: input.search } : {}),
      status: (input.status ?? EXCLUDE_DISMANTLE) as Status,
    },
    input.page,
    input.limit,
  );

  return { data: data.map(toDTO), total };
}
