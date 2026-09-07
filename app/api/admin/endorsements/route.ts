import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  createEndorsementSchema,
  buildSignerUrl,
  EndorsementNotificationService,
  EndorsementService,
  listEndorsementSchema,
  toEndorsementListItem,
} from "@/modules/endorsement";

const service = new EndorsementService();
const notifications = new EndorsementNotificationService();

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
 * Memakai multipart karena berkas PDF ikut dikirim. Token short link tiap
 * penanda tangan hanya dikembalikan di respons ini dan tidak pernah tersimpan
 * mentah, jadi pemanggil wajib langsung mengirimkannya.
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

    const parsed = createEndorsementSchema
      .omit({ sourceFileKey: true, sourceFileName: true, sourceFileHash: true })
      .parse(JSON.parse(payloadRaw));

    const { endorsement, links } = await service.create(
      {
        title: parsed.title,
        description: parsed.description,
        sourceType: parsed.sourceType,
        sourceId: parsed.sourceId,
        fileName: file.name,
        fileBuffer: Buffer.from(await file.arrayBuffer()),
        expiresAt: parsed.expiresAt,
        signers: parsed.signers,
      },
      ctx.session!.user.id,
    );

    // Tautan dikirim sekarang juga: token tidak pernah tersimpan mentah,
    // sehingga tidak ada kesempatan kedua untuk mengambilnya.
    const deliveries = await notifications.sendInvitations({
      endorsementTitle: endorsement.title,
      tenantId: endorsement.tenantId,
      links,
    });

    await service.markSent(endorsement.id);

    return apiSuccess({
      endorsement: toEndorsementListItem(endorsement),
      deliveries,
      // URL hanya dikembalikan di respons pembuatan supaya admin bisa
      // meneruskannya manual bila kanal otomatis gagal.
      links: links.map((link) => ({
        signerId: link.signerId,
        name: link.name,
        url: buildSignerUrl(link.token),
      })),
    });
  },
);
