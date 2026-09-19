import { Status } from "@prisma/client";
import { createHandler } from "@/lib/api";
import { ApiErrors, apiPaginated } from "@/lib/api-response";
import {
  listMobilePelanggan,
  SiteAccessDeniedError,
} from "@/modules/pelanggan";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** True bila `value` adalah salah satu anggota enum Prisma `Status`. */
export function isValidStatus(value: string): value is Status {
  return Object.values(Status).includes(value as Status);
}

/** Baca query daftar pelanggan; nilai tidak masuk akal dikembalikan ke default. */
export function parseListQuery(searchParams: URLSearchParams) {
  const page = Number.parseInt(searchParams.get("page") ?? "", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);

  return {
    // String kosong (mis. "?status=") dianggap sama dengan status tidak
    // dikirim sama sekali — kalau tidak, `??` di MobilePelangganService
    // tidak pernah jatuh ke default exclude-DISMANTLE karena "" bukan
    // null/undefined.
    status: searchParams.get("status") || null,
    search: searchParams.get("search"),
    siteId: searchParams.get("siteId"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit:
      Number.isFinite(limit) && limit > 0
        ? Math.min(limit, MAX_LIMIT)
        : DEFAULT_LIMIT,
  };
}

/** GET /api/mobile/pelanggan — daftar pelanggan untuk aplikasi mobile karyawan. */
export const GET = createHandler(
  { auth: true, permissions: ["m_pelanggan:read"] },
  async (req, ctx) => {
    const query = parseListQuery(req.nextUrl.searchParams);

    if (query.status !== null && !isValidStatus(query.status)) {
      return ApiErrors.badRequest(`Status tidak valid: ${query.status}`);
    }

    try {
      const { data, total } = await listMobilePelanggan({
        session: ctx.session!,
        ...query,
        status: query.status as Status | null,
      });
      return apiPaginated(data, {
        page: query.page,
        limit: query.limit,
        total,
      });
    } catch (error) {
      if (error instanceof SiteAccessDeniedError) {
        return ApiErrors.forbidden(error.message);
      }
      throw error;
    }
  },
);
