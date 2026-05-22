import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  return readSourceFile("app/admin/users/components/MultiSiteSelect.tsx");
}

function readUserColumns(): string {
  return readSourceFile("app/admin/users/lib/userColumns.tsx");
}

function readAdminLayout(): string {
  return readSourceFile("app/admin/layout.tsx");
}

function readLeaveBalanceSettings(): string {
  return readSourceFile("app/admin/users/[id]/LeaveBalanceSettings.tsx");
}

function readUserDetailApi(): string {
  return readSourceFile("app/admin/users/lib/userDetailApi.ts");
}

function readUseUserDetailData(): string {
  return readSourceFile("app/admin/users/lib/useUserDetailData.ts");
}

describe("admin users edit safety", () => {
  it("sends attendance requirement changes in the user update payload", () => {
    const clientFile = readUsersDetailClient();
    const payloadStart = clientFile.indexOf(
      "const updateBody: Record<string, unknown> = {",
    );
    const requestIndex = clientFile.indexOf("await updateAdminUser(id,");

    expect(payloadStart).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(payloadStart);

    const payloadBlock = clientFile.slice(payloadStart, requestIndex);

    expect(payloadBlock).toContain(
      "isAttendanceRequired: formData.isAttendanceRequired,",
    );
  });

  it("allows leave quotas to be managed from the user management flow", () => {
    const clientFile = readUsersDetailClient();
    const routeFile = readLeaveBalanceRoute();

    expect(clientFile).toContain("const canViewLeaveQuotas");
    expect(clientFile).toContain("const canManageLeaveQuotas");
    expect(clientFile).toMatch(/hasPermission\((["'])users:read\1\)/);
    expect(clientFile).toMatch(/hasPermission\((["'])attendance:read\1\)/);
    expect(clientFile).toMatch(/hasPermission\((["'])attendance:update\1\)/);
    expect(clientFile).toContain("canViewLeaveQuotas={canViewLeaveQuotas}");
    expect(clientFile).toContain("{canManageLeaveQuotas && (");

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

  it("keeps admin users copy and new-user save hints consistent", () => {
    const newClientFile = readUsersNewClient();
    const detailClientFile = readUsersDetailClient();
    const leaveBalanceFile = readLeaveBalanceSettings();

    for (const clientFile of [newClientFile, detailClientFile]) {
      expect(clientFile).toContain("Akses & Privilege");
      expect(clientFile).toContain("Fitur Sales & Canvassing");
      expect(clientFile).not.toContain("Akses & Privilese");
      expect(clientFile).not.toContain("Canvasing");
    }

    expect(leaveBalanceFile).toContain("saveButtonLabel");
    expect(newClientFile).toContain('saveButtonLabel="Simpan Pengguna"');
    expect(detailClientFile).toContain('saveButtonLabel="Simpan Perubahan"');
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

  it("normalizes edit-user site relations before filling Site Area Kerja", () => {
    const detailClientFile = readUsersDetailClient();
    const helpersFile = readUserDetailHelpers();

    expect(helpersFile).toContain("function getSelectedSitesFromUser");
    expect(helpersFile).toContain(
      "siteId: userSite.siteId || userSite.site?.id",
    );
    expect(helpersFile).toContain(
      ".filter((site): site is SelectedSite => Boolean(site.siteId))",
    );
    expect(detailClientFile).toContain(
      "const loadedSelectedSites = getSelectedSitesFromUser(usr)",
    );
  });

  it("keeps assigned user sites visible when custom roles cannot list every site", () => {
    const detailClientFile = readUsersDetailClient();
    const helpersFile = readUserDetailHelpers();
    const hookFile = readUseUserDetailData();

    expect(helpersFile).toContain("function getSitesFromUser");
    expect(detailClientFile).toContain(
      "const loadedSites = getSitesFromUser(usr)",
    );
    expect(detailClientFile).toContain(
      "setSites((currentSites) => mergeSites(currentSites, loadedSites))",
    );
    // Reference-data hook dipakai untuk merge sites yang berasal dari
    // endpoint list agar tetap terlihat bersama site yang di-assign user.
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
    // Pastikan tidak ada regresi ke module-level promise cache lama.
    expect(newClientFile).not.toContain("let referenceDataPromise");
    expect(newClientFile).not.toContain("let tenantsPromise");
  });

  it("prevents no-op edit submits while allowing leave quota-only changes", () => {
    const detailClientFile = readUsersDetailClient();

    const snapshotStart = detailClientFile.indexOf(
      "const currentFormSnapshot = JSON.stringify({",
    );
    const changeFlagIndex = detailClientFile.indexOf(
      "const hasFormChanges",
      snapshotStart,
    );

    expect(detailClientFile).toContain("initialFormSnapshot");
    expect(snapshotStart).toBeGreaterThan(-1);
    expect(changeFlagIndex).toBeGreaterThan(snapshotStart);
    expect(detailClientFile.slice(snapshotStart, changeFlagIndex)).toContain(
      "leaveQuotas,",
    );
    expect(detailClientFile).toContain("Object.keys(quotas).length === 0");
    expect(detailClientFile).toContain("hasFormChanges");
    expect(detailClientFile).toContain("Belum ada perubahan untuk disimpan");
    expect(detailClientFile).toContain(
      "disabled={submitting || !hasFormChanges}",
    );
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

  it("does not report full success when leave quota saving fails", () => {
    const detailClientFile = readUsersDetailClient();
    const apiFile = readUserDetailApi();

    expect(detailClientFile).toContain(
      "await saveLeaveQuotas(id, leaveQuotas)",
    );
    expect(apiFile).toContain('fetch("/api/admin/leave-balance"');
    expect(apiFile).toContain('method: "POST"');
    expect(detailClientFile).toContain(
      "Data pengguna tersimpan, tetapi kuota cuti gagal diperbarui",
    );
    expect(detailClientFile).not.toContain(
      "// Don't fail the whole save just because quotas failed",
    );
  });

  it("keeps new-user reference data hook resilient to unmount and tenant permission changes", () => {
    const hookFile = readUseUserDetailData();

    // Hook harus punya guard `active` flag ala useEffect cleanup agar setState
    // tidak dipanggil setelah komponen unmount.
    expect(hookFile).toContain("let active = true");
    expect(hookFile).toContain("if (active) setLoading(false)");
    expect(hookFile).toContain("return () => {");
    expect(hookFile).toContain("active = false");
  });
});
