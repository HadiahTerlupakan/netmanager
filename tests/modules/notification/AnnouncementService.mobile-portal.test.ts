import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({
  prisma: {
    announcement: {
      findMany: vi.fn(),
    },
  },
}));

describe("AnnouncementService mobile portal resolution", () => {
  let resolveMobilePortal: (typeof import("@/modules/notification/services/AnnouncementService.helpers"))["resolveMobilePortal"];

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ resolveMobilePortal } =
      await import("@/modules/notification/services/AnnouncementService.helpers"));
  });

  it("resolves admin portal by accessAdminPanel capability, not role substring", async () => {
    const portalForCustomAdmin = resolveMobilePortal(
      "CUSTOM_ADMIN",
      false,
      false,
    );
    expect(portalForCustomAdmin).toBe("employee");

    const portalForSuperAdmin = resolveMobilePortal("SUPER_ADMIN", true, false);
    expect(portalForSuperAdmin).toBe("admin");

    const portalForRegularWithFlag = resolveMobilePortal(
      "EMPLOYEE",
      false,
      true,
    );
    expect(portalForRegularWithFlag).toBe("admin");
  });

  it("does not infer admin from role name substring alone", async () => {
    const portalForAdminNamed = resolveMobilePortal(
      "ADMIN_PAYMENT",
      false,
      false,
    );
    expect(portalForAdminNamed).toBe("employee");

    const portalForSuperNamed = resolveMobilePortal(
      "SUPER_ADMIN",
      false,
      false,
    );
    expect(portalForSuperNamed).toBe("employee");
  });

  it("resolves customer portal by CUSTOMER actor type", async () => {
    const portalForCustomer = resolveMobilePortal("CUSTOMER", false);
    expect(portalForCustomer).toBe("customer");
  });

  it("defaults to employee portal for non-admin, non-customer roles", async () => {
    const portalForEmployee = resolveMobilePortal("EMPLOYEE", false);
    expect(portalForEmployee).toBe("employee");

    const portalForTechnician = resolveMobilePortal("TECHNICIAN", false);
    expect(portalForTechnician).toBe("employee");
  });
});
