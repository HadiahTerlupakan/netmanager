import { describe, expect, it } from "vitest";

import {
  createResellerSchema,
  listResellersQuerySchema,
  updateResellerComplianceSettingSchema,
  updateResellerSchema,
} from "@/modules/reseller/validators/reseller";
import { createResellerOutletSchema } from "@/modules/reseller/validators/reseller-outlet";

const BASE = { code: "R-1", name: "Reseller" };

describe("validator data izin reseller", () => {
  it("menerima NIB 13 digit dan KBLI 5 digit", () => {
    const result = createResellerSchema.safeParse({
      ...BASE,
      nib: "1234567890123",
      kbliCode: "61994",
      standardCertificateNumber: "SS-1",
      legalName: "PT Mitra",
      brandName: "",
      licenseVerified: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      nib: "1234567890123",
      brandName: null,
    });
  });

  it("KBLI lain (mis. KBLI 2025) tetap diterima selama 5 digit", () => {
    expect(updateResellerSchema.safeParse({ kbliCode: "61201" }).success).toBe(
      true,
    );
  });

  it.each([
    [{ nib: "12345" }, "NIB harus 13 digit angka"],
    [{ nib: "12345678901ab" }, "NIB harus 13 digit angka"],
    [{ kbliCode: "6199" }, "Kode KBLI harus 5 digit angka"],
  ])("menolak %j", (input, message) => {
    const result = updateResellerSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("NIB kosong menjadi null", () => {
    expect(updateResellerSchema.parse({ nib: " " })).toEqual({ nib: null });
  });
});

describe("validator status kemitraan", () => {
  it("menerima SUSPENDED dan TERMINATED pada update", () => {
    expect(
      updateResellerSchema.safeParse({ status: "SUSPENDED" }).success,
    ).toBe(true);
    expect(
      updateResellerSchema.safeParse({ status: "TERMINATED" }).success,
    ).toBe(true);
  });

  it("reseller baru yang langsung ditangguhkan wajib beralasan", () => {
    const result = createResellerSchema.safeParse({
      ...BASE,
      status: "SUSPENDED",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["statusReason"]);
  });

  it("filter daftar menerima status baru", () => {
    expect(
      listResellersQuerySchema.parse({ status: "TERMINATED" }).status,
    ).toBe("TERMINATED");
  });

  it("outlet tetap hanya ACTIVE/INACTIVE", () => {
    expect(
      createResellerOutletSchema.safeParse({
        code: "O",
        name: "O",
        status: "SUSPENDED",
      }).success,
    ).toBe(false);
  });

  it("pengaturan kepatuhan wajib boolean", () => {
    expect(
      updateResellerComplianceSettingSchema.safeParse({
        isComplianceRequired: "ya",
      }).success,
    ).toBe(false);
  });

  it("pengaturan tata kelola menerima satu sakelar saja, menolak body kosong", () => {
    expect(
      updateResellerComplianceSettingSchema.safeParse({
        isSettlementSeparateApproverRequired: true,
      }).success,
    ).toBe(true);
    expect(
      updateResellerComplianceSettingSchema.safeParse({
        isComplianceRequired: false,
      }).success,
    ).toBe(true);
    expect(updateResellerComplianceSettingSchema.safeParse({}).success).toBe(
      false,
    );
    expect(
      updateResellerComplianceSettingSchema.safeParse({
        isSettlementSeparateApproverRequired: "ya",
      }).success,
    ).toBe(false);
  });
});
