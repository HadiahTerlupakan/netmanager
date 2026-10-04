import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  createEndorsementPayloadSchema,
  EndorsementIssueService,
  EndorsementService,
  listEndorsementSchema,
  toEndorsementListItem,
} from "@/modules/endorsement";

const service = new EndorsementService();
const issuer = new EndorsementIssueService(service);

/** Isi field `payload` berupa JSON; null bila bukan JSON yang sah. */
function parseJsonField(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** GET /api/admin/endorsements — daftar surat pengesahan. */
export const GET = createHandler(
  { auth: true, permissions: ["pengesahan:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = listEndorsementSchema.parse({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await service.list(filters);

    return apiSuccess({
      items: result.items.map(toEndorsementListItem),
      total: result.total,
      page: filters.page,
      limit: filters.limit,
    });
  },
);

/**
 * POST /api/admin/endorsements — buat surat baru.
 *
 * Memakai multipart karena berkas PDF ikut dikirim. Tautan langsung dikirim
 * ke penanda tangan; URL-nya hanya dikembalikan di respons ini supaya admin
 * bisa meneruskannya manual bila kanal otomatis gagal.
 */
export const POST = createHandler(
  { auth: true, permissions: ["pengesahan:create"] },
  async (request: NextRequest, ctx) => {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return ApiErrors.badRequest("Berkas PDF wajib diunggah");
    }

    if (file.type !== "application/pdf") {
      return ApiErrors.badRequest("Berkas harus berformat PDF");
    }

    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") {
      return ApiErrors.badRequest("Data surat tidak lengkap");
    }

    const payload = parseJsonField(payloadRaw);
    if (payload === null) {
      return ApiErrors.badRequest("Data surat tidak valid");
    }

    const parsed = createEndorsementPayloadSchema.parse(payload);
    const result = await issuer.issue(
      {
        ...parsed,
        fileName: file.name,
        fileBuffer: Buffer.from(await file.arrayBuffer()),
      },
      ctx.session!.user.id,
    );

    return apiSuccess({
      endorsement: toEndorsementListItem(result.endorsement),
      deliveries: result.deliveries,
      links: result.links,
    });
  },
);
