import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  disconnectSessionByUsername: vi.fn(),
}));

vi.mock("@/modules/network", () => ({
  RadiusSyncService: class MockRadiusSyncService {
    disconnectSessionByUsername = mockFns.disconnectSessionByUsername;
  },
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: Request,
      ctx: { session: { user: { tenantId?: string } } },
    ) => unknown,
  ) => {
    return (req: Request) =>
      handler(req, { session: { user: { tenantId: "tenant-1" } } } as never);
  },
  apiSuccess: (data: unknown, options?: { message?: string }) => ({
    success: true,
    data,
    message: options?.message,
  }),
  ApiErrors: {
    badRequest: (message: string) => ({
      success: false,
      error: message,
      status: 400,
    }),
    forbidden: (message: string) => ({
      success: false,
      error: message,
      status: 403,
    }),
    notFound: (resource: string) => ({
      success: false,
      error: `${resource} tidak ditemukan`,
      status: 404,
    }),
    internalError: (message: string) => ({
      success: false,
      error: message,
      status: 500,
    }),
  },
}));

import { POST } from "@/app/api/admin/radius/sessions/reset/route";

describe("POST /api/admin/radius/sessions/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid JSON bodies with bad request", async () => {
    const request = new Request(
      "http://localhost/api/admin/radius/sessions/reset",
      {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      },
    );

    const response = await (
      POST as unknown as (req: Request) => Promise<unknown>
    )(request);
    const json = response as unknown as {
      success: boolean;
      error?: string;
      status?: number;
    };

    expect(json.success).toBe(false);
    expect(json.error).toBe("Body JSON tidak valid");
    expect(json.status).toBe(400);
    expect(mockFns.disconnectSessionByUsername).not.toHaveBeenCalled();
  });

  it("maps tenant-not-found errors without string matching in the route", async () => {
    mockFns.disconnectSessionByUsername.mockResolvedValueOnce({
      success: false,
      disconnected: 0,
      error: "Pelanggan tidak ditemukan untuk tenant ini",
    });

    const request = new Request(
      "http://localhost/api/admin/radius/sessions/reset",
      {
        method: "POST",
        body: JSON.stringify({ username: "alice" }),
        headers: { "content-type": "application/json" },
      },
    );

    const response = await (
      POST as unknown as (req: Request) => Promise<unknown>
    )(request);
    const json = response as unknown as {
      success: boolean;
      error?: string;
      status?: number;
    };

    expect(json.success).toBe(false);
    expect(json.error).toBe("Pelanggan tidak ditemukan");
    expect(json.status).toBe(404);
  });
});
