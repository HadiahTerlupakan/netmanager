import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  hasPermission: vi.fn(),
  ensureSiteAccess: vi.fn(),
  getStatus: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  readSignature: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
}));
vi.mock("@/app/api/inventory/restock/_lib/restock-site-access", () => ({
  ensureRestockRequestSiteAccess: mocks.ensureSiteAccess,
  ensureRestockGudangSiteAccess: vi.fn(),
}));
vi.mock("@/modules/inventory", async () => {
  const messages = await vi.importActual<
    typeof import("@/modules/inventory/services/restock-messages")
  >("@/modules/inventory/services/restock-messages");
  const url = await vi.importActual<
    typeof import("@/modules/inventory/services/restock-purchase-link-url")
  >("@/modules/inventory/services/restock-purchase-link-url");
  return {
    ...messages,
    ...url,
    createRestockPurchaseLinkService: () => ({
      getStatus: mocks.getStatus,
      create: mocks.create,
      revoke: mocks.revoke,
    }),
    createRestockPurchaseSignatureReader: () => ({ read: mocks.readSignature }),
  };
});

import {
  DELETE,
  GET,
  POST,
} from "@/app/api/inventory/restock/requests/[id]/purchase-link/route";
import { GET as GET_SIGNATURE } from "@/app/api/inventory/restock/requests/[id]/purchases/[recordId]/signature/route";

const TOKEN = "T".repeat(43);
const LINK = {
  id: "link-1",
  createdAt: new Date("2026-11-09T03:00:00Z"),
  expiresAt: new Date("2026-12-09T03:00:00Z"),
  lastUsedAt: null as Date | null,
  createdByName: "Sari",
};
const SERIALIZED_LINK = {
  id: "link-1",
  createdAt: "2026-11-09T03:00:00.000Z",
  expiresAt: "2026-12-09T03:00:00.000Z",
  lastUsedAt: null as string | null,
  createdByName: "Sari",
};

function call(handler: typeof GET, method: string) {
  return handler(
    new NextRequest(
      "http://localhost/api/inventory/restock/requests/pr-1/purchase-link",
      {
        method,
      },
    ),
    { params: Promise.resolve({ id: "pr-1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://radpro.example";
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "admin-1",
      name: "Sari",
      tenantId: "tenant-1",
      permissions: [],
    },
  });
  mocks.hasPermission.mockResolvedValue(true);
  mocks.ensureSiteAccess.mockResolvedValue(null);
  mocks.getStatus.mockResolvedValue({
    success: true,
    data: { link: LINK, availability: "AVAILABLE" },
  });
  mocks.create.mockResolvedValue({
    success: true,
    data: { link: LINK, token: TOKEN },
  });
  mocks.revoke.mockResolvedValue({ success: true, data: { revoked: true } });
});

describe("/api/inventory/restock/requests/[id]/purchase-link", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["DELETE", DELETE],
  ])("%s: 403 tanpa izin restock:verify", async (method, handler) => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await call(handler, method);

    expect(response.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:verify");
  });

  it("403 di luar lingkup site", async () => {
    const { NextResponse } = await import("next/server");
    mocks.ensureSiteAccess.mockResolvedValue(
      NextResponse.json({ error: "beda site" }, { status: 403 }),
    );

    expect((await call(POST, "POST")).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("GET tidak pernah memuat url atau token", async () => {
    const response = await call(GET, "GET");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      data: { link: SERIALIZED_LINK, availability: "AVAILABLE" },
    });
    expect(JSON.stringify(body)).not.toMatch(/url|token|hash/i);
  });

  it("POST 201 mengembalikan url dengan token di fragmen", async () => {
    const response = await call(POST, "POST");

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: {
        link: SERIALIZED_LINK,
        url: `https://radpro.example/belanja#${TOKEN}`,
      },
    });
    expect(mocks.create).toHaveBeenCalledWith("pr-1", "tenant-1", "admin-1");
  });

  it("POST 404 / 409", async () => {
    mocks.create.mockResolvedValueOnce({
      success: false,
      code: "NOT_FOUND",
      error: "Pengajuan tidak ditemukan.",
    });
    expect((await call(POST, "POST")).status).toBe(404);

    mocks.create.mockResolvedValueOnce({
      success: false,
      code: "UNAVAILABLE",
      error: "Semua barang sudah dibeli.",
    });
    const conflict = await call(POST, "POST");
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe("Semua barang sudah dibeli.");
  });

  it("DELETE mematikan link", async () => {
    const response = await call(DELETE, "DELETE");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { revoked: true } });
    expect(mocks.revoke).toHaveBeenCalledWith("pr-1", "tenant-1", "admin-1");
  });
});

describe("GET .../purchases/[recordId]/signature", () => {
  function get() {
    return GET_SIGNATURE(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/purchases/rec-1/signature",
      ),
      { params: Promise.resolve({ id: "pr-1", recordId: "rec-1" }) },
    );
  }

  it("403 tanpa izin restock:read", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect((await get()).status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:read");
    expect(mocks.readSignature).not.toHaveBeenCalled();
  });

  it("404 bila tanda tangan bukan milik pengajuan", async () => {
    mocks.readSignature.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Tanda tangan tidak ditemukan.");
    expect(mocks.readSignature).toHaveBeenCalledWith({
      purchaseRequestId: "pr-1",
      recordId: "rec-1",
      tenantId: "tenant-1",
    });
  });

  it("200 PNG dengan header aman", async () => {
    mocks.readSignature.mockResolvedValue(Buffer.from([0x89, 0x50]));

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="ttd.png"',
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50]),
    );
  });
});
