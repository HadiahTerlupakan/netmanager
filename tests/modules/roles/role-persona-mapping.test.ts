import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { RoleMapper } from "@/modules/roles/mappers/RoleMapper";
import {
  buildRolePayload,
  toCreateRoleRepositoryInput,
  toUpdateRoleRepositoryInput,
} from "@/modules/roles/services/role-service.payloads";

const rolePrisma: Role = {
  id: "role-1",
  name: "Sales",
  description: null,
  accessAdminPanel: false,
  accessEmployeePanel: true,
  isRestricted: false,
  isTechnical: false,
  isSuperAdmin: false,
  persona: "SALES",
  canApproveRab: false,
  canReceiveWhatsappApproval: false,
  tenantId: "tenant-1",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("RoleMapper — persona", () => {
  it("mengalirkan persona dari Prisma ke entity, list DTO, dan detail DTO", () => {
    const entity = RoleMapper.toDomain(rolePrisma);
    expect(entity.persona).toBe("SALES");
    expect(RoleMapper.toListItemDTO(entity).persona).toBe("SALES");
    expect(RoleMapper.toDetailDTO(entity).persona).toBe("SALES");
  });
});

describe("role-service payloads — persona", () => {
  const masukan = {
    name: "Teknisi",
    permissions: ["m_work_order:read"],
    persona: "TEKNISI" as const,
  };

  it("buildRolePayload mempertahankan persona", () => {
    expect(buildRolePayload(masukan, masukan.permissions).persona).toBe(
      "TEKNISI",
    );
  });

  it("payload repository create & update membawa persona", () => {
    expect(toCreateRoleRepositoryInput(masukan, ["p1"]).persona).toBe(
      "TEKNISI",
    );
    expect(toUpdateRoleRepositoryInput(masukan, ["p1"]).persona).toBe(
      "TEKNISI",
    );
  });

  it("update tanpa persona tidak mengirim nilai (persona lama tetap)", () => {
    const { persona: _diabaikan, ...tanpaPersona } = masukan;
    expect(
      toUpdateRoleRepositoryInput(tanpaPersona, []).persona,
    ).toBeUndefined();
  });
});
