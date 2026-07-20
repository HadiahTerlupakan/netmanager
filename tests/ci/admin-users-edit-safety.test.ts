import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contract tests: safety edit Pengguna (IAM) + surface HR kepegawaian.
 * Setelah PRD-HR-MENU-SPLIT v2, jam kerja / site / kuota cuti pindah ke
 * /admin/hr/employees/[id] — assertion HR mengunci path baru, bukan UsersDetailClient.
 */

function readSourceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readUsersDetailClient(): string {
  return readSourceFile("app/admin/users/[id]/UsersDetailClient.tsx");
}

function readUserDetailHelpers(): string {
  return readSourceFile("app/admin/users/[id]/user-detail-helpers.ts");
}

function readUsersNewClient(): string {
  return readSourceFile("app/admin/users/new/UsersNewClient.tsx");
}

function readLeaveBalanceRoute(): string {
  return readSourceFile("app/api/admin/leave-balance/route.ts");
}

function readMultiSiteSelect(): string {
  // Canonical setelah extract HR; path users adalah thin re-export
  return readSourceFile("app/admin/hr/_components/MultiSiteSelect.tsx");
}

function readUserColumns(): string {
  return readSourceFile("app/admin/users/lib/userColumns.tsx");
}

function readAdminLayout(): string {
  return readSourceFile("app/admin/layout.tsx");
}

function readLeaveBalanceSettings(): string {
  return readSourceFile("app/admin/hr/_components/LeaveBalanceSettings.tsx");
}

function readUserDetailApi(): string {
  return readSourceFile("app/admin/users/lib/userDetailApi.ts");
}

function readUseUserDetailData(): string {
  return readSourceFile("app/admin/users/lib/useUserDetailData.ts");
}

function readUserFormSections(): string {
  return readSourceFile("app/admin/users/components/UserFormSections.tsx");
}

function readHrDetailClient(): string {
  return readSourceFile(
    "app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx",
  );
}

function readHrDetailForm(): string {
  return readSourceFile("app/admin/hr/employees/[id]/hrDetailForm.ts");
}

describe("admin users edit safety", () => {
  it("sends attendance requirement changes from HR employee update payload", () => {
    const hrForm = readHrDetailForm();
    const hrClient = readHrDetailClient();
    const usersClient = readUsersDetailClient();

    expect(hrForm).toContain(
      "isAttendanceRequired: formData.isAttendanceRequired",
    );
    expect(hrClient).toContain("buildHrUpdateBody");
    expect(hrClient).toContain("updateAdminUser");

    // Pengguna edit tidak lagi mengirim field attendance
    const payloadStart = usersClient.indexOf(
      "const updateBody: Record<string, unknown> = {",
    );
    const requestIndex = usersClient.indexOf("await updateAdminUser(id,");
    expect(payloadStart).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(payloadStart);
    const payloadBlock = usersClient.slice(payloadStart, requestIndex);
    expect(payloadBlock).not.toContain("isAttendanceRequired");
  });

  it("allows leave quotas to be managed from the HR employee flow", () => {
    const hrClient = readHrDetailClient();
    const usersClient = readUsersDetailClient();
    const routeFile = readLeaveBalanceRoute();

    expect(hrClient).toContain("const canManageLeaveQuotas");
    expect(hrClient).toMatch(/hasPermission\((["'])users:update\1\)/);
    expect(hrClient).toMatch(/hasPermission\((["'])attendance:update\1\)/);
    expect(hrClient).toContain("{canManageLeaveQuotas && (");
    expect(hrClient).toContain("LeaveBalanceSettings");

    // View mode Pengguna masih boleh menampilkan ringkasan cuti (read)
    expect(usersClient).toContain("const canViewLeaveQuotas");
    expect(usersClient).toMatch(/hasPermission\((["'])users:read\1\)/);
    expect(usersClient).toMatch(/hasPermission\((["'])attendance:read\1\)/);
    expect(usersClient).toContain("canViewLeaveQuotas={canViewLeaveQuotas}");

    // Edit Pengguna tidak mount LeaveBalanceSettings
    expect(usersClient).not.toContain("<LeaveBalanceSettings");

    expect(routeFile).toMatch(
      /permissions:\s*\[\s*["']attendance:read["'],\s*["']attendance:update["'],\s*["']users:read["']\s*\]/,
    );
    expect(routeFile).toMatch(
      /permissions:\s*\[\s*["']attendance:update["'],\s*["']users:update["']\s*\]/,
    );
  });

  it("renders overtime inputs without any casts", () => {
    const clientFile = readUsersDetailClient();

    expect(clientFile).not.toContain(
      "(formData as any)[`overtimeCalcType${item.key}`]",
    );
    expect(clientFile).not.toContain(
      "(formData as any)[`overtimeRate${item.key}`]",
    );
  });

  it("uses Indonesian validation and accessible primary form fields", () => {
    const newClientFile = readUsersNewClient();
    const detailClientFile = readUsersDetailClient();

    for (const clientFile of [newClientFile, detailClientFile]) {
      expect(clientFile).toContain("<form onSubmit={handleSubmit} noValidate");
      expect(clientFile).toContain('id="tenantId"');
      expect(clientFile).toContain('htmlFor="tenantId"');
      expect(clientFile).toContain('id="roleId"');
      expect(clientFile).toContain('htmlFor="roleId"');
      expect(clientFile).toContain('id="name"');
      expect(clientFile).toContain('htmlFor="name"');
      expect(clientFile).toContain('id="phone"');
      expect(clientFile).toContain('htmlFor="phone"');
      expect(clientFile).toContain('id="password"');
      expect(clientFile).toContain('htmlFor="password"');
      expect(clientFile).toMatch(
        /aria-label=\{\s*showPassword\s*\?\s*"Sembunyikan kata sandi"\s*:\s*"Tampilkan kata sandi"\s*\}/,
      );
      expect(clientFile).toContain('aria-label="Buat kata sandi otomatis"');
      expect(clientFile).toContain("newErrors.tenantId =");
      expect(clientFile).not.toMatch(/\srequired(?:\s|>|$)/);
    }

    expect(newClientFile).toContain('id="email"');
    expect(newClientFile).toContain('htmlFor="email"');
  });

  it("keeps admin users copy and HR leave-save hints consistent", () => {
    const newClientFile = readUsersNewClient();
    const detailClientFile = readUsersDetailClient();
    const leaveBalanceFile = readLeaveBalanceSettings();
    const formSectionsFile = readUserFormSections();
    const hrClient = readHrDetailClient();

    for (const clientFile of [newClientFile, detailClientFile]) {
      expect(clientFile).toContain("StatusAndSalesSection");
      expect(clientFile).not.toContain("Akses & Privilese");
      expect(clientFile).not.toContain("Canvasing");
    }

    expect(formSectionsFile).toContain("Akses & Privilege");
    expect(formSectionsFile).toContain("Fitur Sales & Canvassing");
    expect(formSectionsFile).not.toContain("Akses & Privilese");
    expect(formSectionsFile).not.toContain("Canvasing");

    // LeaveBalanceSettings canonical di HR; label simpan di surface HR
    expect(leaveBalanceFile).toContain("saveButtonLabel");
    expect(hrClient).toContain('saveButtonLabel="Simpan Perubahan"');
    // Create user tidak lagi mount LeaveBalanceSettings
    expect(newClientFile).not.toContain("<LeaveBalanceSettings");
    expect(detailClientFile).not.toContain("<LeaveBalanceSettings");
  });

  it("makes list actions and multisite selector accessible", () => {
    const listFile = readUserColumns();
    const multiSiteFile = readMultiSiteSelect();

    expect(listFile).toContain(
      "aria-label={`Lihat detail ${user.name || user.email}`}",
    );
    expect(listFile).toContain(
      "aria-label={`Force logout ${user.name || user.email}`}",
    );
    expect(listFile).toContain(
      "aria-label={`Hapus ${user.name || user.email}`}",
    );
    expect(multiSiteFile).toContain('id="user-sites"');
    expect(multiSiteFile).toContain('htmlFor="user-sites"');
    expect(multiSiteFile).toContain('role="combobox"');
    expect(multiSiteFile).toContain("aria-expanded={isOpen}");
    expect(multiSiteFile).toContain("aria-label={`Hapus site ${site.code}`}");
    expect(multiSiteFile).toMatch(
      /aria-label=\{\s*primary\s*\?\s*"Site utama"\s*:\s*`Jadikan \$\{site\.code\} sebagai site utama`\s*\}/,
    );
  });

  it("normalizes HR employee site relations before filling Site Area Kerja", () => {
    const hrClient = readHrDetailClient();
    const helpersFile = readUserDetailHelpers();

    expect(helpersFile).toContain("function getSelectedSitesFromUser");
    expect(helpersFile).toContain(
      "siteId: userSite.siteId || userSite.site?.id",
    );
    expect(helpersFile).toContain(
      ".filter((site): site is SelectedSite => Boolean(site.siteId))",
    );
    expect(hrClient).toContain("getSelectedSitesFromUser(usr)");
  });

  it("keeps assigned user sites visible when custom roles cannot list every site", () => {
    const hrClient = readHrDetailClient();
    const helpersFile = readUserDetailHelpers();
    const hookFile = readUseUserDetailData();

    expect(helpersFile).toContain("function getSitesFromUser");
    expect(hrClient).toContain("getSitesFromUser(usr)");
    expect(hrClient).toContain("mergeSites");
    // Reference-data hook masih dipakai create/list users untuk merge sites
    expect(hookFile).toContain(
      "setSites((current) => mergeSites(current, value))",
    );
  });

  it("guards admin layout against mobile horizontal overflow", () => {
    const layoutFile = readAdminLayout();

    expect(layoutFile).toContain("overflow-x-hidden");
    expect(layoutFile).toContain("w-full");
  });

  it("loads new-user reference data once per tenant-read permission state", () => {
    const newClientFile = readUsersNewClient();
    const hookFile = readUseUserDetailData();

    expect(newClientFile).toMatch(
      /const canReadTenants = hasPermission\((["'])tenants:read\1\)/,
    );
    expect(newClientFile).toContain(
      "useUserReferenceData({\n    canReadTenants,\n  })",
    );
    expect(hookFile).toContain("if (canReadTenants)");
    expect(hookFile).toContain("}, [canReadTenants])");
    expect(newClientFile).not.toContain("let referenceDataPromise");
    expect(newClientFile).not.toContain("let tenantsPromise");
  });

  it("prevents no-op IAM edit submits; HR tracks leave quota changes", () => {
    const detailClientFile = readUsersDetailClient();
    const hrClient = readHrDetailClient();

    // Pengguna: dirty tracking tanpa leaveQuotas
    expect(detailClientFile).toContain("hasFormChanges");
    expect(detailClientFile).toContain("Belum ada perubahan untuk disimpan");
    expect(detailClientFile).toContain(
      "disabled={submitting || !hasFormChanges}",
    );
    expect(detailClientFile).not.toContain("leaveQuotas");

    // HR: dirty tracking termasuk leaveQuotas
    expect(hrClient).toContain("leaveQuotas");
    expect(hrClient).toContain("hasFormChanges");
    expect(hrClient).toContain("Object.keys(quotas).length === 0");
    expect(hrClient).toContain("disabled={submitting || !hasFormChanges}");
  });

  it("keeps edit-user password validation aligned with the server minimum", () => {
    const detailClientFile = readUsersDetailClient();

    expect(detailClientFile).toContain("formData.password.length < 8");
    expect(detailClientFile).toContain(
      "Password minimal 8 karakter jika diisi",
    );
  });

  it("normalizes numeric edit-user fields before sending PATCH", () => {
    const detailClientFile = readUsersDetailClient();

    expect(detailClientFile).toContain("const numericFieldNames = new Set([");
    expect(detailClientFile).toContain("const normalizeNumericField = (");
    expect(detailClientFile).toContain(
      "canvasingTarget: normalizeNumericField(formData.canvasingTarget),",
    );
  });

  it("does not report full success when leave quota saving fails on HR surface", () => {
    const hrClient = readHrDetailClient();
    const apiFile = readUserDetailApi();
    const usersClient = readUsersDetailClient();

    expect(hrClient).toContain("await saveLeaveQuotas(id, leaveQuotas)");
    expect(apiFile).toContain('fetch("/api/admin/leave-balance"');
    expect(apiFile).toContain('method: "POST"');
    expect(hrClient).toMatch(/kuota cuti gagal/i);
    expect(usersClient).not.toContain("await saveLeaveQuotas");
  });

  it("keeps new-user reference data hook resilient to unmount and tenant permission changes", () => {
    const hookFile = readUseUserDetailData();

    expect(hookFile).toContain("let active = true");
    expect(hookFile).toContain("if (active) setLoading(false)");
    expect(hookFile).toContain("return () => {");
    expect(hookFile).toContain("active = false");
  });

  it("edit Pengguna links to HR for kepegawaian fields", () => {
    const detailClientFile = readUsersDetailClient();
    expect(detailClientFile).toContain("/admin/hr/employees/");
    expect(detailClientFile).toContain("Buka di HR");
    expect(detailClientFile).not.toContain("<OrganizationSection");
    expect(detailClientFile).not.toContain("<WorkingHoursSettings");
  });
});
