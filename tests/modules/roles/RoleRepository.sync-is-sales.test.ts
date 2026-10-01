import { describe, expect, it } from "vitest";
import { prismaMock } from "../../setup";
import { RoleRepository } from "@/modules/roles/repositories/RoleRepository";
import { isSalesDariPersona } from "@/modules/roles/client";

function rolePrisma(persona: "SALES" | "STAFF", tenantId: string | null = "tenant-1") {
  return {
    id: "role-1",
    name: "Kepala Sales",
    description: null as string | null,
    accessAdminPanel: false,
    accessEmployeePanel: true,
    isRestricted: false,
    isTechnical: false,
    isSuperAdmin: false,
    persona,
    canApproveRab: false,
    canReceiveWhatsappApproval: false,
    tenantId,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    permission: [] as { id: string; resource: string; action: string }[],
    _count: { user: 2 },
  };
}

describe("isSalesDariPersona", () => {
  it("hanya persona SALES", () => {
    expect(isSalesDariPersona("SALES")).toBe(true);
    expect(isSalesDariPersona("TEKNISI")).toBe(false);
    expect(isSalesDariPersona(null)).toBe(false);
    expect(isSalesDariPersona(undefined)).toBe(false);
  });
});

describe("RoleRepository.update — sinkron User.isSales", () => {
  it("persona menjadi SALES → isSales pengguna role (tenant role) jadi true dalam transaksi", async () => {
    prismaMock.role.update.mockResolvedValue(rolePrisma("SALES"));

    await new RoleRepository().update("role-1", { persona: "SALES" });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { roleId: "role-1", isSales: { not: true }, tenantId: "tenant-1" },
      data: { isSales: true },
    });
  });

  it("persona berganti dari SALES → isSales pengguna jadi false; role global tanpa filter tenant", async () => {
    prismaMock.role.update.mockResolvedValue(rolePrisma("STAFF", null));

    await new RoleRepository().update("role-1", { persona: "STAFF" });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { roleId: "role-1", isSales: { not: false } },
      data: { isSales: false },
    });
  });

  it("tanpa persona di payload, pengguna tidak disentuh", async () => {
    prismaMock.role.update.mockResolvedValue(rolePrisma("SALES"));

    await new RoleRepository().update("role-1", { name: "Ganti nama" });

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });
});
