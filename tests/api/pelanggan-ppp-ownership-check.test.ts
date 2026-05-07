import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPppDetail = vi.fn();
const mockCanAccessSite = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((_options, handler) => handler),
    ApiErrors: {
      forbidden: vi.fn((msg) => ({ error: msg, status: 403 })),
      notFound: vi.fn((msg) => ({ error: msg, status: 404 })),
    },
  };
});

vi.mock("@/modules/pelanggan", () => ({
  PelangganAdminQueryService: class {
    getPppDetail = mockGetPppDetail;
  },
  PelangganAdminMutationService: class {},
}));

vi.mock("@/modules/roles", () => ({
  canAccessSite: mockCanAccessSite,
}));

describe("pelanggan PPP ownership check", () => {
  let GET: (typeof import("@/app/api/pelanggan-ppp/[id]/route"))["GET"];

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ GET } = await import("@/app/api/pelanggan-ppp/[id]/route"));
    mockCanAccessSite.mockReturnValue(true);
  });

  it("blocks CUSTOMER role from accessing other customer data", async () => {
    mockGetPppDetail.mockResolvedValue({
      pelanggan: { id: "pel-2", nama: "Other", siteId: "site-1" },
      technicalInfo: {},
    });

    const response = await GET(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-2"),
      {
        params: { id: "pel-2" },
        session: {
          user: { id: "pel-1", role: "CUSTOMER", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response).toEqual({
      error: "Anda tidak diperbolehkan melihat data pelanggan lain",
      status: 403,
    });
    expect(mockGetPppDetail).not.toHaveBeenCalled();
  });

  it("allows CUSTOMER role to access own data", async () => {
    mockGetPppDetail.mockResolvedValue({
      pelanggan: {
        id: "pel-1",
        nama: "Self",
        username: "self",
        siteId: "site-1",
      },
      technicalInfo: { onlineStatus: "ONLINE" },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-1"),
      {
        params: { id: "pel-1" },
        session: {
          user: { id: "pel-1", role: "CUSTOMER", tenantId: "tenant-1" },
        },
      } as never,
    );
    const json = (await response.json()) as {
      success: boolean;
      data: { id: string; username: string };
    };

    expect(mockGetPppDetail).toHaveBeenCalledWith("pel-1", "tenant-1");
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ id: "pel-1", username: "self" });
  });
});
