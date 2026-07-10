import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  checkSiteRestriction: vi.fn(),
  replyToTicket: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      const wrappedHandler = async (req: NextRequest, ctx: unknown) =>
        handler(req, ctx);
      (wrappedHandler as unknown as { options: unknown }).options = options;
      return wrappedHandler;
    }),
    buildSessionWithPermissions: vi.fn((session, permissions) => ({
      ...session,
      user: { ...session.user, permissions },
      expires: "",
    })),
    apiSuccess: vi.fn((data, options) =>
      NextResponse.json({ success: true, data, ...options }, { status: 200 }),
    ),
    apiError: vi.fn((message, _code, opts) =>
      NextResponse.json(
        { success: false, error: message },
        { status: opts?.status ?? 400 },
      ),
    ),
    ApiErrors: {
      notFound: vi.fn((resource) =>
        NextResponse.json(
          { success: false, error: `${resource} tidak ditemukan` },
          { status: 404 },
        ),
      ),
      forbidden: vi.fn((msg) =>
        NextResponse.json(
          { success: false, error: msg ?? "Akses ditolak" },
          { status: 403 },
        ),
      ),
      internalError: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 500 }),
      ),
    },
    ErrorCodes: {
      VALIDATION_ERROR: "VALIDATION_ERROR",
      FORBIDDEN: "FORBIDDEN",
    },
  };
});

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
}));

vi.mock("@/modules/pelanggan", () => ({
  getAdminSupportTicketRouteService: () => ({
    replyToTicket: mockFns.replyToTicket,
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), apiRequest: vi.fn() },
}));

import { POST } from "@/app/api/admin/support-tickets/[id]/reply/route";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function buildRequest() {
  return new NextRequest(
    "http://localhost/api/admin/support-tickets/tid/reply",
    {
      method: "POST",
    },
  );
}

function buildCtx(input: { validated: unknown; permissions?: string[] }) {
  return {
    validated: input.validated,
    query: {},
    params: { id: VALID_UUID },
    session: {
      user: {
        id: "admin-1",
        email: "admin@example.com",
        tenantId: "t1",
        isSuperAdmin: false,
      },
    },
    permissions: input.permissions ?? ["support:update"],
  };
}

const invoke = POST as unknown as (
  req: NextRequest,
  ctx: unknown,
) => Promise<Response>;

describe("POST /api/admin/support-tickets/[id]/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteIds: [],
      siteId: undefined,
      userSiteId: null,
      primarySiteId: null,
    });
    mockFns.replyToTicket.mockResolvedValue({
      success: true,
      data: { reply: { id: "r1" }, whatsappSent: false },
    });
  });

  it("returns 400 when both message and attachments are empty", async () => {
    const res = await invoke(
      buildRequest(),
      buildCtx({ validated: { message: "   ", attachments: [] } }),
    );
    expect(res.status).toBe(400);
    expect(mockFns.replyToTicket).not.toHaveBeenCalled();
  });

  it("passes allowedSiteIds to service when admin has support:site_only", async () => {
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: ["site-a"],
      siteId: "site-a",
      userSiteId: "site-a",
      primarySiteId: "site-a",
    });

    const res = await invoke(
      buildRequest(),
      buildCtx({
        validated: { message: "ok" },
        permissions: ["support:update", "support:site_only"],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockFns.replyToTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: VALID_UUID,
        senderId: "admin-1",
        message: "ok",
        allowedSiteIds: ["site-a"],
      }),
    );
  });

  it("returns 200 for happy path without site restriction", async () => {
    const res = await invoke(
      buildRequest(),
      buildCtx({ validated: { message: "reply body", sendWhatsApp: false } }),
    );

    expect(res.status).toBe(200);
    expect(mockFns.replyToTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: VALID_UUID,
        message: "reply body",
        sendWhatsApp: false,
        allowedSiteIds: undefined,
      }),
    );
  });

  it("maps service FORBIDDEN result to 403 (out-of-scope ticket)", async () => {
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: ["site-a"],
      siteId: "site-a",
      userSiteId: "site-a",
      primarySiteId: "site-a",
    });
    mockFns.replyToTicket.mockResolvedValue({
      success: false,
      code: "FORBIDDEN",
      error: "Anda tidak dapat membalas tiket di luar scope",
    });

    const res = await invoke(
      buildRequest(),
      buildCtx({
        validated: { message: "hi" },
        permissions: ["support:update", "support:site_only"],
      }),
    );
    expect(res.status).toBe(403);
  });

  it("maps service VALIDATION_ERROR (closed ticket) to 400", async () => {
    mockFns.replyToTicket.mockResolvedValue({
      success: false,
      code: "VALIDATION_ERROR",
      error: "Tiket sudah ditutup dan tidak dapat dibalas",
    });

    const res = await invoke(
      buildRequest(),
      buildCtx({ validated: { message: "hi" } }),
    );
    expect(res.status).toBe(400);
  });

  it("maps service NOT_FOUND result to 404", async () => {
    mockFns.replyToTicket.mockResolvedValue({
      success: false,
      code: "NOT_FOUND",
      error: "Tiket tidak ditemukan",
    });

    const res = await invoke(
      buildRequest(),
      buildCtx({ validated: { message: "hi" } }),
    );
    expect(res.status).toBe(404);
  });
});
