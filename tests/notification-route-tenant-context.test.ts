import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/notifications/route.ts", "utf8");
const handlerSource = readFileSync("lib/api/handler.ts", "utf8");

describe("notifications API tenant context", () => {
  it("delegates auth + tenant context wrapping to the shared handler factory", () => {
    // Route harus pakai createHandler — sumber tenant context disediakan di sana
    // sehingga setiap akses Prisma berjalan di tenant scope user yang login.
    expect(routeSource).toContain("createHandler");
    expect(routeSource).toMatch(/auth:\s*true/);
  });

  it("ensures the shared handler factory wraps requests in tenant context", () => {
    // Why: regression guard — kalau wrapping ini hilang, semua route via
    // createHandler kehilangan multi-tenant isolation.
    expect(handlerSource).toContain("runWithRequestTenantContext");
    expect(handlerSource).toMatch(
      /tenantId:\s*ctx\.session\?\.user\?\.tenantId\s*\|\|\s*null/,
    );
  });
});
