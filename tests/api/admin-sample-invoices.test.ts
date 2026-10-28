import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class SampleInvoiceInputError extends Error {}
  return {
    SampleInvoiceInputError,
    generate: vi.fn(),
    list: vi.fn(),
    zip: vi.fn(),
    parts: vi.fn(),
    remove: vi.fn(),
    getLimits: vi.fn(),
    saveLimits: vi.fn(),
    issuer: vi.fn(),
  };
});

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-response")>(
      "@/lib/api-response",
    );
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    requireSessionTenantId: (ctx: {
      session: { user: { tenantId: string } };
    }) => ctx.session.user.tenantId,
  };
});
vi.mock("@/modules/sample-invoice", () => ({
  SampleInvoiceInputError: mocks.SampleInvoiceInputError,
  generateSampleBatch: mocks.generate,
  listSampleBatches: mocks.list,
  buildSampleBatchZip: mocks.zip,
  getSampleBatchParts: mocks.parts,
  deleteSampleBatch: mocks.remove,
  getSampleInvoiceLimits: mocks.getLimits,
  saveSampleInvoiceLimits: mocks.saveLimits,
  getIssuerPrefill: mocks.issuer,
}));

import { GET as LIST, POST } from "@/app/api/admin/sample-invoices/route";
import { GET as DOWNLOAD } from "@/app/api/admin/sample-invoices/[id]/download/route";
import { PUT as SAVE_LIMITS } from "@/app/api/admin/sample-invoices/limits/route";

const ctx = (extra: Record<string, unknown> = {}) =>
  ({
    session: { user: { id: "u1", name: "Admin", tenantId: "t1" } },
    params: {},
    query: {},
    ...extra,
  }) as never;

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/sample-invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("admin sample invoices API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the batch and its download parts", async () => {
    mocks.generate.mockResolvedValue({
      batchId: "b1",
      parts: [{ key: "all" }],
    });

    const response = await POST(post({ any: 1 }), ctx());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      batchId: "b1",
      parts: [{ key: "all" }],
    });
    expect(mocks.generate).toHaveBeenCalledWith(
      "t1",
      { id: "u1", name: "Admin" },
      { any: 1 },
    );
  });

  it("shows the validation message as a 400", async () => {
    mocks.generate.mockRejectedValue(
      new mocks.SampleInvoiceInputError(
        "Jumlah PDF 2.400 melewati batas 2.000",
      ),
    );

    const response = await POST(post({}), ctx());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Jumlah PDF 2.400 melewati batas 2.000",
    );
  });

  it("lists history filtered by mitra", async () => {
    mocks.list.mockResolvedValue({ items: [], total: 0 });

    await LIST(
      new NextRequest("http://localhost/x"),
      ctx({ query: { mitraId: "m1", page: "2" } }),
    );

    expect(mocks.list).toHaveBeenCalledWith({
      mitraId: "m1",
      page: 2,
      limit: 20,
    });
  });

  it("downloads a ZIP part as an attachment", async () => {
    mocks.zip.mockResolvedValue({
      fileName: "contoh.zip",
      buffer: Buffer.from("PK"),
    });

    const response = await DOWNLOAD(
      new NextRequest("http://localhost/x"),
      ctx({ params: { id: "b1" }, query: { part: "2026-09" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="contoh.zip"',
    );
    expect(mocks.zip).toHaveBeenCalledWith("b1", "2026-09");
  });

  it("answers 404 for an unknown batch or part", async () => {
    mocks.zip.mockResolvedValue(null);

    const response = await DOWNLOAD(
      new NextRequest("http://localhost/x"),
      ctx({ params: { id: "b1" }, query: {} }),
    );

    expect(response.status).toBe(404);
    expect(mocks.zip).toHaveBeenCalledWith("b1", "all");
  });

  it("rejects invalid limits as a 400", async () => {
    mocks.saveLimits.mockRejectedValue(
      new Error("Setiap batas harus bilangan bulat minimal 1"),
    );

    const response = await SAVE_LIMITS(
      new NextRequest("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({ maxCustomers: 0 }),
      }),
      ctx(),
    );

    expect(response.status).toBe(400);
  });
});
