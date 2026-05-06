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

describe("admin users edit safety", () => {
  it("sends attendance requirement changes in the user update payload", () => {
    const clientFile = readUsersDetailClient();
    const payloadStart = clientFile.indexOf(
      "const updateBody: Record<string, unknown> = {",
    );
    const requestIndex = clientFile.indexOf(
      "const userRes = await fetch(`/api/admin/users/${id}`, {",
    );

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
    expect(clientFile).toContain("{canViewLeaveQuotas && (");
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

    expect(helpersFile).toContain("function getSitesFromUser");
    expect(detailClientFile).toContain(
      "const loadedSites = getSitesFromUser(usr)",
    );
    expect(detailClientFile).toContain(
      "setSites((currentSites) => mergeSites(currentSites, loadedSites))",
    );
    expect(detailClientFile).toContain(
      "setSites((currentSites) => mergeSites(currentSites, availableSites))",
    );
  });

  it("guards admin layout against mobile horizontal overflow", () => {
    const layoutFile = readAdminLayout();

    expect(layoutFile).toContain("overflow-x-hidden");
    expect(layoutFile).toContain("w-full");
  });

  it("loads new-user reference data once per tenant-read permission state", () => {
    const newClientFile = readUsersNewClient();

    expect(newClientFile).toMatch(
      /const canReadTenants = hasPermission\((["'])tenants:read\1\)/,
    );
    expect(newClientFile).toContain("hasLoadedReferenceData");
    expect(newClientFile).toContain("hasLoadedTenants");
    expect(newClientFile).toContain("}, [canReadTenants])");
    expect(newClientFile).not.toContain("}, [hasPermission])");
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

  it("resets new-user reference caches even when request failures happen after unmount", () => {
    const newClientFile = readUsersNewClient();
    const referenceCacheResetIndex = newClientFile.indexOf(
      "referenceDataPromise = null",
    );
    const tenantCacheResetIndex = newClientFile.indexOf(
      "tenantsPromise = null",
    );
    const unmountedReferenceReturnIndex = newClientFile.indexOf(
      "if (!isMounted) return",
      referenceCacheResetIndex,
    );
    const unmountedTenantReturnIndex = newClientFile.indexOf(
      "if (!isMounted) return",
      tenantCacheResetIndex,
    );

    expect(referenceCacheResetIndex).toBeGreaterThan(-1);
    expect(tenantCacheResetIndex).toBeGreaterThan(-1);
    expect(unmountedReferenceReturnIndex).toBeGreaterThan(
      referenceCacheResetIndex,
    );
    expect(unmountedTenantReturnIndex).toBeGreaterThan(tenantCacheResetIndex);
  });
});
