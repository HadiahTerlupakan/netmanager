import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  assertCanAssignRole,
  RoleAssignmentForbiddenError,
} from "@/modules/users/services/role-assignment-guard";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SUPER_ROLE = { id: "r1", name: "Teknisi", isSuperAdmin: true };
const NAMED_SUPER_ROLE = { id: "r2", name: "SUPER_ADMIN", isSuperAdmin: false };
const NORMAL_ROLE = { id: "r3", name: "Helpdesk", isSuperAdmin: false };

describe("assertCanAssignRole", () => {
  // Regresi: users:assign_super_admin didefinisikan di permission-config dan
  // di-seed, tapi nol penegakan di seluruh repo. Pemegang users:create bisa
  // membuat akun dengan roleId superadmin lalu login sebagai superadmin.
  it("menolak pemberian role ber-flag superadmin tanpa users:assign_super_admin", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: SUPER_ROLE,
        actorPermissions: ["users:create"],
        actorIsSuperAdmin: false,
      }),
    ).toThrow(RoleAssignmentForbiddenError);
  });

  // Status superadmin juga bisa datang dari NAMA role, bukan hanya flag.
  it("menolak pemberian role bernama SUPER_ADMIN tanpa permission itu", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: NAMED_SUPER_ROLE,
        actorPermissions: ["users:create"],
        actorIsSuperAdmin: false,
      }),
    ).toThrow(RoleAssignmentForbiddenError);
  });

  it("mengizinkan pemegang users:assign_super_admin", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: SUPER_ROLE,
        actorPermissions: ["users:create", "users:assign_super_admin"],
        actorIsSuperAdmin: false,
      }),
    ).not.toThrow();
  });

  it("mengizinkan aktor yang memang superadmin", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: SUPER_ROLE,
        actorPermissions: [],
        actorIsSuperAdmin: true,
      }),
    ).not.toThrow();
  });

  it("mengizinkan wildcard *", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: SUPER_ROLE,
        actorPermissions: ["*"],
        actorIsSuperAdmin: false,
      }),
    ).not.toThrow();
  });

  it("tidak menghalangi pemberian role biasa", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: NORMAL_ROLE,
        actorPermissions: ["users:create"],
        actorIsSuperAdmin: false,
      }),
    ).not.toThrow();
  });

  it("aman saat role tujuan tidak diketahui", () => {
    expect(() =>
      assertCanAssignRole({
        targetRole: null,
        actorPermissions: ["users:create"],
        actorIsSuperAdmin: false,
      }),
    ).not.toThrow();
  });
});

describe("elevasi CRON_SECRET", () => {
  // Regresi: CRON_SECRET optional di lib/env.ts. Bila tidak diset,
  // `Bearer ${undefined}` menjadi literal "Bearer undefined" dan siapa pun
  // yang mengirimnya mendapat { tenantId: null, isSuperAdmin: true }.
  it("tidak melakukan elevasi saat CRON_SECRET kosong", () => {
    const source = read("lib/tenant-context.ts");
    const marker = source.indexOf("CRON_SECRET");
    const block = source.slice(Math.max(0, marker - 500), marker + 300);

    expect(block).toMatch(/if\s*\(\s*cronSecret\s*&&|!cronSecret\s*\|\|/);
  });
});
