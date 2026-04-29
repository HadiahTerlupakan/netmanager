import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";
import { UserRepository } from "@/modules/users/repositories/UserRepository";

describe("UserRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
  });

  it("finds user upload permission context by id", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      role: {
        name: "ADMIN",
        accessAdminPanel: true,
        permission: [{ resource: "app_version", action: "create" }],
      },
    });

    const repository = new UserRepository();
    const result = await repository.findUploadPermissionContextById("user-1");

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: { role: { include: { permission: true } } },
    });
    expect(result).toEqual({
      id: "user-1",
      email: "admin@example.com",
      role: {
        name: "ADMIN",
        accessAdminPanel: true,
        permission: [{ resource: "app_version", action: "create" }],
      },
    });
  });

  it("reports inactive filter totals without negative inactive stats", async () => {
    prismaMock.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const repository = new UserRepository();
    const result = await repository.findAll({
      search: "finance",
      isActive: false,
    });

    expect(result).toMatchObject({ total: 1, active: 0, inactive: 1 });
  });

  it("targets overtime WhatsApp approval to the dedicated role type only", async () => {
    const repository = new UserRepository();
    await repository.findAdminsForNotification("tenant-1", "site-1");

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        OR: expect.arrayContaining([
          { role: { isSuperAdmin: true } },
          expect.objectContaining({
            AND: expect.arrayContaining([
              { role: { canReceiveWhatsappApproval: true } },
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { siteId: "site-1" },
                  { siteId: null },
                  { userSites: { some: { siteId: "site-1" } } },
                ]),
              }),
            ]),
          }),
        ]),
      }),
      select: { id: true, phone: true },
    });
  });
});
