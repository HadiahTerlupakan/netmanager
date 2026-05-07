import { describe, expect, it } from "vitest";
import { applyWorkOrderListRestrictions } from "@/modules/work-order/services/work-order-service-helpers";

describe("Work order restriction superadmin bypass", () => {
  it("bypasses department restriction for superadmin using canonical detection", () => {
    const result = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: ["workorders:department_only"],
      userDepartmentId: "dept-1",
      userRole: "SUPER_ADMIN",
    });

    expect(result).not.toBeNull();
    expect(result?.departmentId).toBeUndefined();
  });

  it("bypasses site restriction for superadmin using canonical detection", () => {
    const result = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: ["workorders:site_only"],
      userSiteId: "site-1",
      userRole: "SUPER_ADMIN",
    });

    expect(result).not.toBeNull();
    expect(result?.siteId).toBeUndefined();
  });

  it("applies department restriction for non-superadmin", () => {
    const result = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: ["workorders:department_only"],
      userDepartmentId: "dept-1",
      userRole: "REGULAR_ROLE",
    });

    expect(result).not.toBeNull();
    expect(result?.departmentId).toBe("dept-1");
  });
});
