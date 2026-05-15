import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getInvestors: vi.fn(),
  createInvestor: vi.fn(),
}));

// Mock dependencies
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      // Store options on the handler for testing
      const wrappedHandler = async (
        req: NextRequest & { clone: () => NextRequest },
        ctx: { validated?: unknown },
      ) => {
        // Inject validated data if schema exists
        if (options.schema && req.json) {
          try {
            const body = await req.clone().json();
            ctx.validated = options.schema.parse(body);
          } catch (_e) {
            // simple mock validation logic
          }
        }
        return handler(req, ctx);
      };
      (wrappedHandler as unknown as { options: unknown }).options = options;
      return wrappedHandler;
    }),
    apiSuccess: vi.fn((data, options) =>
      NextResponse.json({ success: true, data }, options),
    ),
    ApiErrors: {
      badRequest: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 400 }),
      ),
    },
  };
});

vi.mock("@/modules/investor", () => ({
  getInvestors: mockFns.getInvestors,
  createInvestor: mockFns.createInvestor,
}));

import { GET, POST } from "@/app/api/admin/investors/route";

describe("Investors API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET Handler", () => {
    it("should have correct permissions", () => {
      expect(
        (GET as unknown as { options: { permissions: string[] } }).options
          .permissions,
      ).toContain("investors:read");
    });

    it("should delegate investors list retrieval to the finance service", async () => {
      mockFns.getInvestors.mockResolvedValue({
        success: true,
        data: [
          { id: "1", username: "inv1", namaLengkap: "Inv One" },
          { id: "2", username: "inv2", namaLengkap: "Inv Two" },
        ],
      });

      const request = new NextRequest("http://localhost/api/admin/investors");
      const response = await (
        GET as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>
      )(request, { permissions: ["investors:read"] });
      const json = (await response.json()) as {
        success: boolean;
        data: Array<{ username: string; passwordHash?: string }>;
      };

      expect(mockFns.getInvestors).toHaveBeenCalled();
      expect(json.success).toBe(true);
      expect(json.data[0]).not.toHaveProperty("passwordHash");
      expect(json.data[0].username).toBe("inv1");
    });
  });

  describe("POST Handler", () => {
    it("should have correct permissions and schema", () => {
      const postHandler = POST as unknown as {
        options: { permissions: string[]; schema: unknown };
      };
      expect(postHandler.options.permissions).toContain("investors:create");
      expect(postHandler.options.schema).toBeDefined();
    });

    it("should delegate investor creation to the finance service and return a safe investor", async () => {
      const payload = {
        username: "newinv",
        password: "password123",
        namaLengkap: "New Investor",
        email: "new@example.com",
      };

      mockFns.createInvestor.mockResolvedValue({
        success: true,
        data: {
          id: "new-id",
          username: "newinv",
          namaLengkap: "New Investor",
          email: "new@example.com",
        },
      });

      const request = new NextRequest("http://localhost/api/admin/investors", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const response = await (
        POST as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>
      )(request, { validated: payload });
      const json = (await response.json()) as {
        success: boolean;
        data: { username: string; passwordHash?: string };
      };

      expect(json.success).toBe(true);
      expect(mockFns.createInvestor).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "newinv",
          password: "password123",
        }),
        undefined,
      );
      expect(json.data.username).toBe("newinv");
      expect(json.data).not.toHaveProperty("passwordHash");
    });

    it("should return bad request when the finance service rejects creation input", async () => {
      const payload = {
        username: "newinv",
        namaLengkap: "New Investor",
        email: "new@example.com",
      };

      mockFns.createInvestor.mockResolvedValue({
        success: false,
        error: "Password wajib diisi untuk membuat investor baru",
        code: "BAD_REQUEST",
      });

      const request = new NextRequest("http://localhost/api/admin/investors", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const response = await (
        POST as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>
      )(request, { validated: payload });
      const json = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(json.error).toContain("Password wajib diisi");
    });
  });
});
