import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  hasPermission: vi.fn(),
  resolveLink: vi.fn(),
  getList: vi.fn(),
  submit: vi.fn(),
  loggerError: vi.fn(),
  contexts: [] as string[],
}));

vi.mock("@/lib/redis", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: (_reason: string, callback: () => Promise<unknown>) => {
    mocks.contexts.push("system");
    return callback().finally(() => mocks.contexts.pop());
  },
  runWithRequestTenantContext: (
    context: { tenantId: string; isSuperAdmin: boolean },
    callback: () => Promise<unknown>,
  ) => {
    mocks.contexts.push(`tenant:${context.tenantId}:${context.isSuperAdmin}`);
    return callback().finally(() => mocks.contexts.pop());
  },
}));
vi.mock("@/modules/inventory", async () => {
  const domain = await vi.importActual<
    typeof import("@/modules/inventory/domain/restock-purchase-link")
  >("@/modules/inventory/domain/restock-purchase-link");
  const currentContext = () => mocks.contexts.at(-1);
  return {
    PURCHASE_LINK_MESSAGES: domain.PURCHASE_LINK_MESSAGES,
    createRestockPublicPurchaseService: () => ({
      resolveLink: (token: string) =>
        mocks.resolveLink(token, currentContext()),
      getList: (link: unknown) => mocks.getList(link, currentContext()),
      submit: (link: unknown, input: unknown, client: unknown) =>
        mocks.submit(link, input, client, currentContext()),
    }),
  };
});

import { POST as postCatat } from "@/app/api/belanja/catat/route";
import { POST as postDaftar } from "@/app/api/belanja/daftar/route";

const TOKEN = "Ab_-".repeat(10) + "xyz";
const LINK = {
  id: "link-1",
  purchaseRequestId: "pr-1",
  tenantId: "tenant-1",
  createdById: "admin-1",
  expiresAt: new Date("2026-12-09T03:00:00Z"),
};
const SIGNATURE = "data:image/png;base64,iVBORw0KGgo=";
const recordBody = {
  token: TOKEN,
  clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
  buyerName: "Joko",
  storeName: "Toko Sinar",
  purchasedAt: "2026-11-09",
  signatureDataUrl: SIGNATURE,
  items: [{ purchaseOrderItemId: "poi-1", quantity: 2 }],
};
const INACTIVE_BODY = {
  success: false,
  error: "Link ini sudah tidak berlaku.",
  code: "LINK_INACTIVE",
};

function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost/api/belanja/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.9",
      "user-agent": "HP Uji",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toBe(
    "noindex, nofollow, noarchive",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  // Route ini tidak lewat proxy.ts, jadi header ini dipasang sendiri.
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("content-security-policy")).toBe(
    "default-src 'none'; frame-ancestors 'none'",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contexts.length = 0;
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.hasPermission.mockResolvedValue(true);
  mocks.resolveLink.mockResolvedValue(LINK);
  mocks.getList.mockResolvedValue({
    success: true,
    data: {
      state: "ACTIVE",
      requestNumber: "PR-1",
      warehouseName: "G",
      validUntil: "x",
      items: [],
    },
  });
  mocks.submit.mockResolvedValue({
    success: true,
    data: { state: "ACTIVE", message: "ok", isReplay: false },
  });
});

describe("POST /api/belanja/daftar", () => {
  it("200: cari link di system context, daftar di konteks tenant link", async () => {
    const response = await postDaftar(request("daftar", { token: TOKEN }));

    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
    expect(mocks.resolveLink).toHaveBeenCalledWith(TOKEN, "system");
    expect(mocks.getList).toHaveBeenCalledWith(LINK, "tenant:tenant-1:false");
  });

  it("404 generik identik untuk semua alasan link tidak berlaku", async () => {
    const formatSalah = await postDaftar(request("daftar", { token: "salah" }));

    mocks.resolveLink.mockResolvedValueOnce(null);
    const tidakAda = await postDaftar(request("daftar", { token: TOKEN }));

    mocks.getList.mockResolvedValueOnce({
      success: false,
      code: "LINK_INACTIVE",
      error: "apa saja",
    });
    const selesai = await postDaftar(request("daftar", { token: TOKEN }));

    for (const response of [formatSalah, tidakAda, selesai]) {
      expect(response.status).toBe(404);
      expectSecurityHeaders(response);
      expect(await response.json()).toEqual(INACTIVE_BODY);
    }
  });

  it("415 bila bukan JSON", async () => {
    const response = await postDaftar(
      request("daftar", "token=x", {
        "content-type": "application/x-www-form-urlencoded",
      }),
    );

    expect(response.status).toBe(415);
    expectSecurityHeaders(response);
    expect((await response.json()).code).toBe("UNSUPPORTED");
  });

  it("400 bila JSON rusak atau ada field asing", async () => {
    expect((await postDaftar(request("daftar", "{rusak"))).status).toBe(400);
    expect(
      (await postDaftar(request("daftar", { token: TOKEN, lain: 1 }))).status,
    ).toBe(400);
  });

  it("429 per IP dicek sebelum body dibaca: body rusak pun terhitung", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce(false);

    const response = await postDaftar(request("daftar", "{rusak"));

    expect(response.status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("kunci IP memakai IP dari proxy, bukan entri X-Forwarded-For kiriman klien", async () => {
    await postDaftar(
      request(
        "daftar",
        { token: TOKEN },
        {
          "x-real-ip": "",
          "x-forwarded-for": "1.2.3.4, 198.51.100.7",
        },
      ),
    );
    await postDaftar(
      request(
        "daftar",
        { token: TOKEN },
        {
          "x-real-ip": "",
          "x-forwarded-for": "9.9.9.9, 198.51.100.7",
        },
      ),
    );

    const ipKeys = mocks.checkRateLimit.mock.calls
      .map(([key]) => key as string)
      .filter((key) => key.includes(":ip:"));
    expect(ipKeys).toEqual([
      "belanja:daftar:ip:198.51.100.7",
      "belanja:daftar:ip:198.51.100.7",
    ]);
  });

  it("404 generik bila pembuat link sudah tidak berhak membuat link", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    const response = await postDaftar(request("daftar", { token: TOKEN }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(INACTIVE_BODY);
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      "restock:verify",
      { id: "admin-1" },
      { silent: true },
    );
    expect(mocks.getList).not.toHaveBeenCalled();
  });

  it("429 per IP; kunci rate limit tidak memuat token", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce(false);

    const response = await postDaftar(request("daftar", { token: TOKEN }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expectSecurityHeaders(response);
    expect(mocks.resolveLink).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit.mock.calls[0][0]).toBe(
      "belanja:daftar:ip:203.0.113.9",
    );
  });

  it("429 per link memakai potongan hash, bukan token", async () => {
    mocks.checkRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await postDaftar(request("daftar", { token: TOKEN }));

    expect(response.status).toBe(429);
    const linkKey = mocks.checkRateLimit.mock.calls[1][0] as string;
    expect(linkKey).toMatch(/^belanja:daftar:link:[0-9a-f]{32}$/);
    for (const call of mocks.checkRateLimit.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(TOKEN);
    }
    expect(mocks.checkRateLimit.mock.calls[1].slice(1)).toEqual([
      30,
      60,
      { tenantId: null, failClosed: false },
    ]);
  });

  it("500 tanpa token di log", async () => {
    mocks.getList.mockRejectedValueOnce(new Error("db mati"));

    const response = await postDaftar(request("daftar", { token: TOKEN }));

    expect(response.status).toBe(500);
    expectSecurityHeaders(response);
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(TOKEN);
    expect(mocks.loggerError.mock.calls[0][2]).toEqual({ linkId: "link-1" });
  });
});

describe("POST /api/belanja/catat", () => {
  it("201 dan isian diteruskan di konteks tenant link", async () => {
    const response = await postCatat(request("catat", recordBody));

    expect(response.status).toBe(201);
    expectSecurityHeaders(response);
    expect(await response.json()).toEqual({
      data: { state: "ACTIVE", message: "ok", isReplay: false },
    });
    const [link, input, client, context] = mocks.submit.mock.calls[0];
    expect(link).toBe(LINK);
    expect(context).toBe("tenant:tenant-1:false");
    expect(input).toEqual({
      clientRequestId: recordBody.clientRequestId,
      buyerName: "Joko",
      storeName: "Toko Sinar",
      purchasedAt: "2026-11-09",
      notes: null,
      signatureDataUrl: SIGNATURE,
      items: [{ purchaseOrderItemId: "poi-1", quantity: 2, unitPrice: null }],
    });
    expect(client).toEqual({ ipAddress: "203.0.113.9", userAgent: "HP Uji" });
    expect(mocks.checkRateLimit.mock.calls[0].slice(1)).toEqual([
      20,
      60,
      { tenantId: null, failClosed: true },
    ]);
    expect(mocks.checkRateLimit.mock.calls[1].slice(1)).toEqual([
      10,
      60,
      { tenantId: null, failClosed: true },
    ]);
  });

  it("pembuat link nonaktif/tanpa izin: 404 generik, tidak mencatat", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    const response = await postCatat(request("catat", recordBody));

    expect(response.status).toBe(404);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("200 untuk kiriman ulang", async () => {
    mocks.submit.mockResolvedValueOnce({
      success: true,
      data: { state: "ACTIVE", message: "ok", isReplay: true },
    });

    expect((await postCatat(request("catat", recordBody))).status).toBe(200);
  });

  it("413 untuk body di atas 320 KB", async () => {
    const response = await postCatat(
      request("catat", {
        ...recordBody,
        signatureDataUrl: `${SIGNATURE}${"A".repeat(330 * 1024)}`,
      }),
    );

    expect(response.status).toBe(413);
    expectSecurityHeaders(response);
    expect((await response.json()).code).toBe("TOO_LARGE");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("413 dini dari Content-Length tanpa membaca body sama sekali", async () => {
    let pulled = 0;
    // highWaterMark 0: stream hanya ditarik bila memang dibaca.
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(new TextEncoder().encode("{}"));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const response = await postCatat(
      new Request("http://localhost/api/belanja/catat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(1024 * 1024 * 1024),
        },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(413);
    expectSecurityHeaders(response);
    expect(pulled).toBe(0);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("Content-Length yang tidak sah ditolak 413", async () => {
    const response = await postDaftar(
      new Request("http://localhost/api/belanja/daftar", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "banyak",
        },
        body: JSON.stringify({ token: TOKEN }),
      }),
    );

    expect(response.status).toBe(413);
  });

  it("413 juga untuk body chunked tanpa Content-Length, berhenti membaca di batas", async () => {
    const chunk = new TextEncoder().encode("A".repeat(64 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Tanpa ujung: pembaca wajib berhenti sendiri di 320 KB.
        if (sent >= 1000) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const response = await postCatat(
      new Request("http://localhost/api/belanja/catat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(413);
    // 320 KB / 64 KB = 5 potong + 1 yang melewati batas (+ antrean stream).
    expect(sent).toBeLessThan(10);
  });

  it("400 dengan pesan awam untuk isian salah", async () => {
    const response = await postCatat(
      request("catat", { ...recordBody, buyerName: " " }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Isi nama Anda.",
      code: "VALIDATION_ERROR",
    });
    expect(mocks.resolveLink).not.toHaveBeenCalled();
  });

  it("400 untuk field asing (supplierId/fotoNota)", async () => {
    const response = await postCatat(
      request("catat", { ...recordBody, fotoNota: [] }),
    );

    expect(response.status).toBe(400);
  });

  it.each([
    [
      "INVALID",
      400,
      "VALIDATION_ERROR",
      "Tanda tangan dulu di kotak tanda tangan.",
    ],
    ["CONFLICT", 409, "CONFLICT", "Daftar belanja baru saja berubah."],
    [
      "STORAGE_UNAVAILABLE",
      503,
      "STORAGE_UNAVAILABLE",
      "Tanda tangan belum bisa disimpan sekarang. Coba lagi nanti atau hubungi admin gudang.",
    ],
  ])("galat %s → %i", async (code, status, apiCode, error) => {
    mocks.submit.mockResolvedValueOnce({ success: false, code, error });

    const response = await postCatat(request("catat", recordBody));

    expect(response.status).toBe(status);
    expectSecurityHeaders(response);
    expect(await response.json()).toEqual({
      success: false,
      error,
      code: apiCode,
    });
  });

  it("404 generik identik bila link tidak berlaku saat dicatat", async () => {
    mocks.submit.mockResolvedValueOnce({
      success: false,
      code: "LINK_INACTIVE",
      error: "pesan lain",
    });
    const dariSubmit = await postCatat(request("catat", recordBody));
    mocks.resolveLink.mockResolvedValueOnce(null);
    const dariResolve = await postCatat(request("catat", recordBody));

    for (const response of [dariSubmit, dariResolve]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(INACTIVE_BODY);
    }
  });

  it("500 tanpa body/token di log", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("r2 mati"));

    const response = await postCatat(request("catat", recordBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Ada gangguan. Isian Anda masih ada, coba kirim lagi.",
      code: "INTERNAL_ERROR",
    });
    const logged = JSON.stringify(mocks.loggerError.mock.calls);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("Joko");
  });
});
