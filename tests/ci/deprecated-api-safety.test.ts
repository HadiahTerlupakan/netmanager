import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

const deprecatedStringDatetimePattern =
  /z\.string\(\)(?:\.[a-zA-Z]+\([^)]*\))*\.datetime\(/;
const deprecatedStringUuidPattern =
  /z\.string\(\)(?:\.[a-zA-Z]+\([^)]*\))*\.uuid\(/;
const deprecatedStringEmailPattern =
  /z\.string\(\)(?:\.[a-zA-Z]+\([^)]*\))*\.email\(/;
const deprecatedStringUrlPattern =
  /z\.string\(\)(?:\.[a-zA-Z]+\([^)]*\))*\.url\(/;
const deprecatedErrorFormatPattern = /\.error\.format\(/;

describe("deprecated API safety", () => {
  it("does not use deprecated Zod datetime string helper in active validation files", () => {
    const files = [
      "lib/validation/schemas.ts",
      "lib/validations/attendance.ts",
      "lib/validations/device-backup.ts",
      "lib/validations/lembur.ts",
      "lib/validations/network-performance.ts",
      "app/api/network/performance/[id]/history/route.ts",
      "app/api/mobile/location/route.ts",
      "app/api/pelanggan-ppp/[id]/suspend/route.ts",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toMatch(
        deprecatedStringDatetimePattern,
      );
    }
  });

  it("does not use deprecated Zod nativeEnum helper in active validation files", () => {
    const files = [
      "lib/validations/support-ticket.ts",
      "lib/validations/pelanggan.ts",
      "app/api/admin/leave-balance/route.ts",
      "app/api/admin/leaves/route.ts",
      "app/api/admin/salary/components/route.ts",
      "app/api/finance/rab-projects/route.ts",
      "app/api/finance/rab-projects/[id]/route.ts",
      "app/api/finance/rab-projects/[id]/revisions/[revisionId]/route.ts",
      "app/api/inventory/assets/route.ts",
      "app/api/inventory/assets/[id]/route.ts",
      "app/api/invoices/[id]/route.ts",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toContain("nativeEnum(");
    }
  });

  it("does not use deprecated Zod string uuid helper in tracked files", () => {
    const files = [
      "lib/validation/schemas.ts",
      "lib/validations/attendance.ts",
      "lib/validations/support-ticket.ts",
      "lib/validations/lembur.ts",
      "app/api/admin/leaves/route.ts",
      "app/api/admin/leave-balance/route.ts",
      "app/api/admin/salary/components/route.ts",
      "app/api/admin/chat/conversations/route.ts",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toMatch(deprecatedStringUuidPattern);
    }
  });

  it("does not use deprecated Zod string email helper in tracked files", () => {
    const files = [
      "lib/validation/schemas.ts",
      "lib/security/security-tests.ts",
      "lib/validations/user.ts",
      "lib/validations/pelanggan.ts",
      "lib/validations/common.ts",
      "lib/validations/settings.ts",
      "lib/validations/investor.ts",
      "lib/validations/invoice.ts",
      "components/auth/LoginForm.tsx",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toMatch(deprecatedStringEmailPattern);
    }
  });

  it("does not use deprecated Zod string url helper in tracked files", () => {
    const files = [
      "lib/env.ts",
      "lib/validations/attendance.ts",
      "lib/validations/settings.ts",
      "app/api/admin/leaves/route.ts",
      "app/api/admin/chat/conversations/[id]/route.ts",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toMatch(deprecatedStringUrlPattern);
    }
  });

  it("does not use deprecated Zod error format helper in tracked files", () => {
    const files = ["app/api/mobile/location/route.ts"];

    for (const file of files) {
      expect(readProjectFile(file)).not.toMatch(deprecatedErrorFormatPattern);
    }
  });

  it("does not use deprecated Zod object merge helper in shared validation utilities", () => {
    expect(readProjectFile("lib/validations/common.ts")).not.toContain(
      ".merge(",
    );
  });

  it("does not use deprecated getSiteFilter helper in route handlers and tests", () => {
    const files = [
      "app/api/admin/support-tickets/route.ts",
      "app/api/admin/users/route.ts",
      "tests/lib/site-restriction.test.ts",
    ];

    for (const file of files) {
      expect(readProjectFile(file)).not.toContain("getSiteFilter(");
    }
  });

  it("keeps invoice detail route aligned with createHandler typing", () => {
    const routeFile = readProjectFile("app/api/invoices/[id]/route.ts");

    expect(routeFile).not.toContain("ctx: RouteContext");
    expect(routeFile).not.toContain(
      "updateSchema.parse(body) as InvoiceUpdateData",
    );
    expect(routeFile).toContain(
      "const validatedData = updateSchema.parse(body);",
    );
  });
});
