import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rbacHasPermission: vi.fn(),
  verifyAuth: vi.fn(),
  authHasPermission: vi.fn(),
  changeItems: vi.fn(),
  findUser: vi.fn(),
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
    getPurchaseOrderItemChangeService: () => ({
      changeItems: mocks.changeItems,
    }),
  };
});

import { PATCH } from "@/app/api/admin/procurement/purchase-orders/[id]/items/route";
import {
  PurchaseOrderItemChangeInvalidError,
  PurchaseOrderNotEditableError,
} from "@/modules/procurement";

function patch(body: unknown) {
  return PATCH(
    new NextRequest(
      "http://localhost/api/admin/procurement/purchase-orders/po-1/items",
      { method: "PATCH", body: JSON.stringify(body) },
    ),
    { params: Promise.resolve({ id: "po-1" }) },
  );
}

const splitCable = {
  reason: "Supplier mengganti sebagian ke kabel 2 core",
  changes: [{ id: "poi-4core", quantity: 2000 }],
  additions: [{ barangId: "b-2core", quantity: 2000, unitPrice: 7000 }],
};

describe("PATCH /api/admin/procurement/purchase-orders/[id]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mocks.verifyAuth.mockResolvedValue({ id: "user-1" });
    mocks.rbacHasPermission.mockResolvedValue(true);
    mocks.authHasPermission.mockResolvedValue(true);
    mocks.findUser.mockResolvedValue({ id: "user-1", roleId: "role-1" });
    mocks.changeItems.mockResolvedValue({
      status: "PARTIAL",
      paymentStatus: "UNPAID",
      grandTotal: 34_000_000,
    });
  });

  it("passes the change with the actor's tenant and role", async () => {
    const response = await patch(splitCable);

    expect(response.status).toBe(200);
    expect(mocks.changeItems).toHaveBeenCalledWith({
      purchaseOrderId: "po-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      actorRoleIds: ["role-1"],
      ...splitCable,
    });
  });

  it("needs purchase_orders:update", async () => {
    mocks.rbacHasPermission.mockResolvedValue(false);

    const response = await patch(splitCable);

    expect(response.status).toBe(403);
    expect(mocks.changeItems).not.toHaveBeenCalled();
  });

  it("needs a reason", async () => {
    const response = await patch({ ...splitCable, reason: " " });

    expect(response.status).toBe(400);
    expect(mocks.changeItems).not.toHaveBeenCalled();
  });

  it("rejects a fractional quantity", async () => {
    const response = await patch({
      ...splitCable,
      changes: [{ id: "poi-4core", quantity: 1.5 }],
    });

    expect(response.status).toBe(400);
  });

  it("returns the rule that was broken as a 400", async () => {
    mocks.changeItems.mockRejectedValue(
      new PurchaseOrderItemChangeInvalidError(
        "Jumlah Kabel 4 Core minimal 2100 karena sudah diterima 2100",
      ),
    );

    const response = await patch(splitCable);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("minimal 2100");
  });

  it("answers 409 for a closed purchase order", async () => {
    mocks.changeItems.mockRejectedValue(new PurchaseOrderNotEditableError());

    const response = await patch(splitCable);

    expect(response.status).toBe(409);
  });
});
