import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function pathOf(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(pathOf(relativePath), "utf8");
}

describe("HR shared components extract", () => {
  it("menyediakan komponen kepegawaian di app/admin/hr/_components", () => {
    for (const file of [
      "app/admin/hr/_components/OrganizationSection.tsx",
      "app/admin/hr/_components/WorkingHoursSettings.tsx",
      "app/admin/hr/_components/LeaveBalanceSettings.tsx",
      "app/admin/hr/_components/MultiSiteSelect.tsx",
      "app/admin/hr/lib/hrEmployeeApi.ts",
      "app/admin/hr/lib/siteHelpers.ts",
    ]) {
      expect(existsSync(pathOf(file)), `missing ${file}`).toBe(true);
    }
  });

  it("users WorkingHoursSettings re-export dari HR (tidak duplikasi logic)", () => {
    const usersWh = readSource("app/admin/users/[id]/WorkingHoursSettings.tsx");
    expect(usersWh).toMatch(/hr\/_components\/WorkingHoursSettings/);
  });

  it("users LeaveBalanceSettings re-export dari HR", () => {
    const usersLb = readSource("app/admin/users/[id]/LeaveBalanceSettings.tsx");
    expect(usersLb).toMatch(/hr\/_components\/LeaveBalanceSettings/);
  });

  it("users MultiSiteSelect re-export dari HR", () => {
    const usersMs = readSource(
      "app/admin/users/components/MultiSiteSelect.tsx",
    );
    expect(usersMs).toMatch(/hr\/_components\/MultiSiteSelect/);
  });

  it("UserFormSections re-export OrganizationSection dari HR", () => {
    const sections = readSource(
      "app/admin/users/components/UserFormSections.tsx",
    );
    expect(sections).toMatch(/hr\/_components\/OrganizationSection/);
  });
});

describe("HR employees list page", () => {
  it("list page HR employees me-require users:read", () => {
    const page = readSource("app/admin/hr/employees/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
    expect(page).toContain("HrEmployeesListClient");
  });

  it("list client exists and uses users API", () => {
    expect(
      existsSync(pathOf("app/admin/hr/employees/HrEmployeesListClient.tsx")),
    ).toBe(true);
    const client = readSource(
      "app/admin/hr/employees/HrEmployeesListClient.tsx",
    );
    expect(client).toMatch(/useUserFetch/);
    expect(client).toContain("/admin/hr/employees/");
    expect(client).toContain("/admin/users");
  });
});

describe("HR employee detail page", () => {
  it("detail page HR employees me-require users:read", () => {
    const page = readSource("app/admin/hr/employees/[id]/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
  });

  it("detail client tidak mengirim password/role", () => {
    const client = readSource(
      "app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx",
    );
    expect(client).not.toMatch(/password\s*:/);
    expect(client).not.toMatch(/roleId\s*:/);
    expect(client).toContain("OrganizationSection");
    expect(client).toContain("WorkingHoursSettings");
    expect(client).toContain("LeaveBalanceSettings");
    expect(client).toContain("updateAdminUser");
  });
});

describe("Pengguna strip HR sections", () => {
  it("edit UsersDetailClient tidak mount section kepegawaian", () => {
    const src = readSource("app/admin/users/[id]/UsersDetailClient.tsx");
    // Section HR dipindah — tidak boleh render komponen ini di edit form
    expect(src).not.toContain("<OrganizationSection");
    expect(src).not.toContain("<WorkingHoursSettings");
    expect(src).not.toContain("<LeaveBalanceSettings");
    expect(src).toContain("/admin/hr/employees/");
  });

  it("create user tidak mount jam kerja / kuota cuti", () => {
    const src = readSource("app/admin/users/new/UsersNewClient.tsx");
    expect(src).not.toContain("<WorkingHoursSettings");
    expect(src).not.toContain("<LeaveBalanceSettings");
    // dept/site onboarding tetap
    expect(src).toContain("OrganizationSection");
  });
});

describe("HR landing page", () => {
  it("landing HR mem-require users:read dan link ke employees", () => {
    const page = readSource("app/admin/hr/page.tsx");
    expect(page).toContain("ensurePermission");
    expect(page).toContain("users:read");
    expect(page).toContain("/admin/hr/employees");
  });
});
