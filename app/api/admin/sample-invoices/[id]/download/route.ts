import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";
import { buildSampleBatchZip } from "@/modules/sample-invoice";

/** ZIP satu bagian riwayat, disusun ulang dari set tersimpan. */
export const GET = createHandler(
  { auth: true, permissions: ["invoice_contoh:read"] },
  async (_req, ctx) => {
    const part = typeof ctx.query.part === "string" ? ctx.query.part : "all";
    const zip = await buildSampleBatchZip(ctx.params.id, part);
    if (!zip) return ApiErrors.notFound("Riwayat atau bagian ZIP");

    return new NextResponse(new Uint8Array(zip.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zip.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
