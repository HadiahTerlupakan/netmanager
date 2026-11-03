import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const CLIENT = "app/admin/resellers/ResellersClient.tsx";
const MODAL = "app/admin/resellers/ResellerModal.tsx";
const PANEL = "app/admin/resellers/ResellerCompliancePanel.tsx";
const TOGGLE = "app/admin/resellers/ComplianceSettingToggle.tsx";
const TYPES = "app/admin/resellers/types.ts";

describe("UI kepatuhan reseller", () => {
  it("bagian pricing reseller disembunyikan dan tidak memanggil package-prices", () => {
    const source = read(CLIENT);

    expect(source).not.toContain("package-prices");
    expect(source).not.toContain("Pricing reseller");
    expect(source).toContain("ResellerCompliancePanel");
  });

  it("daftar menampilkan status PKS dan badge belum patuh", () => {
    expect(read(CLIENT)).toContain("PksStatusBadge");
    expect(read(CLIENT)).toContain("PartnershipStatusCell");
    expect(read("app/admin/resellers/ResellerComplianceBadges.tsx")).toContain(
      "Belum patuh",
    );
  });

  it("form memuat data izin, status baru, dan alasan status", () => {
    const source = read(MODAL);

    for (const field of [
      "legalName",
      "nib",
      "kbliCode",
      "standardCertificateNumber",
      "brandName",
      "licenseVerified",
      "statusReason",
    ]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("61994");
    expect(read(TYPES)).toContain('SUSPENDED: "Ditangguhkan"');
    expect(read(TYPES)).toContain('TERMINATED: "Diakhiri"');
  });

  it("detail menautkan dokumen PKS di modul Legal", () => {
    expect(read(PANEL)).toContain("/admin/legal/dokumen/");
  });

  it("sakelar wajibkan kepatuhan memakai endpoint pengaturan", () => {
    const source = read(TOGGLE);

    expect(source).toContain("/api/admin/resellers/compliance-setting");
    expect(source).toContain("Wajibkan kepatuhan reseller");
  });
});

describe("toResellerForm", () => {
  it("mengisi form edit dari data izin tersimpan", async () => {
    const { toResellerForm, isReasonRequired } =
      await import("@/app/admin/resellers/types");
    const form = toResellerForm({
      id: "r1",
      code: "R1",
      name: "Reseller",
      email: null,
      phone: null,
      address: null,
      status: "SUSPENDED",
      notes: null,
      legalName: "PT Mitra",
      nib: "1234567890123",
      kbliCode: "61994",
      standardCertificateNumber: null,
      brandName: null,
      licenseVerifiedAt: "2026-11-01T00:00:00.000Z",
      statusReason: "Tunggakan",
      statusChangedAt: null,
    });

    expect(form).toMatchObject({
      status: "SUSPENDED",
      statusReason: "Tunggakan",
      nib: "1234567890123",
      standardCertificateNumber: "",
      licenseVerified: true,
    });
    expect(isReasonRequired(form.status)).toBe(true);
    expect(isReasonRequired("INACTIVE")).toBe(false);
  });
});
