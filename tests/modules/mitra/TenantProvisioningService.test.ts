import { describe, expect, it, vi } from "vitest";

import { TenantProvisioningService } from "@/modules/mitra";

const sourcePermission = {
  name: "Read Users",
  action: "read",
  resource: "users",
  description: "Can read users",
};

function createClient() {
  return {
    permission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    settings: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe("TenantProvisioningService", () => {
  it("meng-clone permission, role non-superadmin, dan setting non-sensitif", async () => {
    const client = createClient();
    client.permission.findMany
      .mockResolvedValueOnce([sourcePermission])
      .mockResolvedValueOnce([{ id: "tenant-permission-1" }])
      .mockResolvedValueOnce([{ id: "tenant-permission-1" }]);
    client.permission.findFirst.mockResolvedValue(null);
    client.role.findMany.mockResolvedValue([
      {
        id: "role-1",
        name: "ADMIN",
        description: "Admin",
        accessAdminPanel: true,
        accessEmployeePanel: true,
        isRestricted: false,
        isTechnical: false,
        canApproveRab: true,
        permission: [{ resource: "users", action: "read" }],
      },
    ]);
    client.role.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    client.settings.findMany.mockResolvedValue([
      {
        key: "company_name",
        value: "Net Manager",
        description: "Company",
      },
      {
        key: "R2_SECRET_ACCESS_KEY",
        value: "secret",
        description: "Secret",
      },
    ]);
    client.settings.findFirst.mockResolvedValue(null);
    const service = new TenantProvisioningService(
      client as never,
      () => "generated-id",
      () => new Date("2026-04-27T00:00:00.000Z"),
    );

    const result = await service.provisionTenantData("tenant-1");

    expect(client.permission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "generated-id",
        tenantId: "tenant-1",
        resource: "users",
        action: "read",
      }),
    });
    expect(client.role.create).toHaveBeenCalledTimes(2);
    expect(client.settings.create).toHaveBeenCalledTimes(1);
    expect(client.settings.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: "company_name" }),
    });
    expect(result).toEqual({
      rolesCreated: 1,
      permissionsCreated: 1,
      settingsCreated: 1,
    });
  });

  it("mengambil role admin tenant dengan prioritas super admin", async () => {
    const client = createClient();
    client.role.findFirst.mockResolvedValueOnce({ id: "super-admin-role" });
    const service = new TenantProvisioningService(client as never);

    const result = await service.getTenantAdminRoleId("tenant-1");

    expect(result).toBe("super-admin-role");
    expect(client.role.findFirst).toHaveBeenCalledTimes(1);
  });
});
