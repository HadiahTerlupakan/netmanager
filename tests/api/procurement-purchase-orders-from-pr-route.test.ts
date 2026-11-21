import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rbacHasPermission: vi.fn(),
  verifyAuth: vi.fn(),
  authHasPermission: vi.fn(),
  findUser: vi.fn(),
  generatePOFromPRs: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return { ...actual, getServerSession: mocks.getServerSession };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.rbacHasPermission }));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAuth: mocks.verifyAuth,
    hasPermission: mocks.authHasPermission,
  };
});

vi.mock("@/modules/users", () => ({
  UserLookupService: class {
    findById = mocks.findUser;
  },
}));

vi.mock("@/modules/procurement", async () => {
  const actual = await vi.importActual<typeof import("@/modules/procurement")>(
    "@/modules/procurement",
  );
  return {
    ...actual,
    getProcurementService: () => ({
      generatePOFromPRs: mocks.generatePOFromPRs,
    }),
  };
});

import { POST } from "@/app/api/admin/procurement/purchase-orders/from-pr/route";
import {
  PurchaseRequestAlreadyOrderedError,
  PurchaseRequestNotOrderableError,
} from "@/modules/procurement";

function post(body: unknown) {
  return POST(
    new NextRequest(
      "http://localhost/api/admin/procurement/purchase-orders/from-pr",
      { method: "POST", body: JSON.stringify(body) },
    ),
    { params: Promise.resolve({}) },
  );
}

describe("POST /api/admin/procurement/purchase-orders/from-pr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mocks.verifyAuth.mockResolvedValue({ id: "user-1" });
    mocks.rbacHasPermission.mockResolvedValue(true);
    mocks.authHasPermission.mockResolvedValue(true);
    mocks.findUser.mockResolvedValue({ id: "user-1", roleId: "role-1" });
  });

  it("membuat PO dari pengajuan yang dipilih", async () => {
    mocks.generatePOFromPRs.mockResolvedValue([
      { id: "po-1", poNumber: "PO/2026/11/0001" },
    ]);

    const response = await post({ prIds: ["pr-1"] });

    expect(response.status).toBe(200);
    expect(mocks.generatePOFromPRs).toHaveBeenCalledWith(
      ["pr-1"],
      "user-1",
      undefined,
    );
  });

  it("pengajuan yang baru saja dibuatkan pesanan lain → 409", async () => {
    mocks.generatePOFromPRs.mockRejectedValue(
      new PurchaseRequestAlreadyOrderedError(),
    );

    const response = await post({ prIds: ["pr-1"] });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).toContain("Muat ulang halaman");
  });

  it("pilihan tanpa pengajuan yang bisa dibuatkan PO → 400 berbahasa Indonesia", async () => {
    mocks.generatePOFromPRs.mockRejectedValue(
      new PurchaseRequestNotOrderableError(),
    );

    const response = await post({ prIds: ["pr-1"] });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain(
      "Hanya pengajuan yang sudah disetujui dan belum punya PO",
    );
  });

  it("galat tak terduga tidak membocorkan pesan internal", async () => {
    mocks.generatePOFromPRs.mockRejectedValue(
      new Error('relation "purchase_orders" does not exist'),
    );

    const response = await post({ prIds: ["pr-1"] });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("purchase_orders");
  });
});
