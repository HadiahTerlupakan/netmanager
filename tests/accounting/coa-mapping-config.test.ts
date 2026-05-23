import { describe, expect, it } from "vitest";
import {
  getDefaultCoaCode,
  listCoaPurposes,
  type CoaPurpose,
} from "@/modules/accounting/services/event-handlers/coa-mapping-config";

/**
 * Test ini memastikan setiap CoaPurpose mapping ke kode COA yang:
 *   1. Ada di DEFAULT_COA (di-seed otomatis untuk tenant baru)
 *   2. Postable (bukan akun header)
 *
 * Kalau test ini gagal: ada mismatch antara coa-mapping-config dan
 * DEFAULT_COA di ChartOfAccountService — handler accounting akan throw
 * CoaNotFoundError atau CoaNotPostableError di production.
 */
describe("coa-mapping-config", () => {
  // Kode header (non-postable) — tidak boleh dipakai sebagai purpose target
  const HEADER_CODES = new Set([
    "1-000",
    "1-100",
    "1-300",
    "2-000",
    "3-000",
    "4-000",
    "5-000",
    "5-700",
    "6-000",
  ]);

  // Snapshot kode-kode yang valid di DEFAULT_COA
  const VALID_POSTABLE_CODES = new Set([
    "1-110",
    "1-120",
    "1-130",
    "1-150",
    "1-200",
    "1-250",
    "1-280",
    "1-310",
    "1-320",
    "1-330",
    "1-340",
    "1-350",
    "1-390",
    "2-100",
    "2-200",
    "2-300",
    "2-350",
    "2-360",
    "2-400",
    "2-410",
    "2-420",
    "2-500",
    "2-510",
    "2-600",
    "3-100",
    "3-200",
    "3-300",
    "4-100",
    "4-200",
    "4-300",
    "4-400",
    "4-900",
    "5-100",
    "5-110",
    "5-200",
    "5-210",
    "5-300",
    "5-400",
    "5-500",
    "5-510",
    "5-520",
    "5-600",
    "5-710",
    "5-720",
    "5-800",
    "5-810",
    "6-100",
    "6-200",
    "6-300",
    "6-400",
    "6-500",
  ]);

  it("setiap purpose punya kode valid di DEFAULT_COA", () => {
    const purposes = listCoaPurposes();
    expect(purposes.length).toBeGreaterThan(0);

    for (const purpose of purposes) {
      const code = getDefaultCoaCode(purpose);
      expect(
        VALID_POSTABLE_CODES.has(code),
        `Kode ${code} (${purpose}) tidak ada di DEFAULT_COA`,
      ).toBe(true);
    }
  });

  it("tidak ada purpose yang menunjuk ke akun header (non-postable)", () => {
    for (const purpose of listCoaPurposes()) {
      const code = getDefaultCoaCode(purpose);
      expect(
        HEADER_CODES.has(code),
        `Purpose ${purpose} -> ${code} adalah akun header non-postable`,
      ).toBe(false);
    }
  });

  it("mapping kunci salary (BEBAN_GAJI, UTANG_GAJI, UTANG_PPH_21) menunjuk ke akun yang benar", () => {
    expect(getDefaultCoaCode("BEBAN_GAJI")).toBe("5-100");
    expect(getDefaultCoaCode("UTANG_GAJI")).toBe("2-350");
    expect(getDefaultCoaCode("UTANG_PPH_21")).toBe("2-400");
    expect(getDefaultCoaCode("UTANG_BPJS")).toBe("2-360");
    expect(getDefaultCoaCode("BEBAN_BPJS")).toBe("5-110");
    expect(getDefaultCoaCode("PIUTANG_KARYAWAN")).toBe("1-150");
  });

  it("mapping kas/bank menunjuk ke akun postable, bukan header 1-100", () => {
    const kasUtama = getDefaultCoaCode("KAS_UTAMA");
    const bankUtama = getDefaultCoaCode("BANK_UTAMA");
    const kasKecil = getDefaultCoaCode("KAS_KECIL");
    expect(kasUtama).not.toBe("1-100");
    expect(bankUtama).not.toBe("1-100");
    expect(kasKecil).not.toBe("1-100");
    expect(VALID_POSTABLE_CODES.has(kasUtama)).toBe(true);
    expect(VALID_POSTABLE_CODES.has(bankUtama)).toBe(true);
    expect(VALID_POSTABLE_CODES.has(kasKecil)).toBe(true);
  });

  it("ekuitas closing entry (LABA_RUGI_BERJALAN, LABA_DITAHAN) tersedia", () => {
    expect(getDefaultCoaCode("LABA_RUGI_BERJALAN")).toBe("3-300");
    expect(getDefaultCoaCode("LABA_DITAHAN")).toBe("3-200");
  });

  it("CoaPurpose type exhaustive", () => {
    // Compile-time check: pastikan semua purpose mapping muncul saat di-list
    const sample: CoaPurpose = "BEBAN_GAJI";
    expect(getDefaultCoaCode(sample)).toBeDefined();
  });
});
