import { describe, expect, it } from "vitest";

import {
  buildLegalPayload,
  createEmptyFormValues,
  formValuesFromDetail,
  isIndefiniteByDefault,
  MAX_FILE_BYTES,
  MISSING_VALIDITY_MESSAGE,
  normalizeMoneyInput,
  validateLegalForm,
  type LegalFormValues,
} from "@/app/admin/legal/components/form/legal-form-state";
import type { LegalDocumentDetail } from "@/app/admin/legal/components/legal-types";

function buildValues(overrides: Partial<LegalFormValues> = {}): LegalFormValues {
  return {
    ...createEmptyFormValues(),
    title: "Kontrak sewa tower",
    endDate: "2027-01-01",
    ...overrides,
  };
}

function buildFile(type = "application/pdf", size = 10): File {
  return { type, size, name: "kontrak.pdf" } as File;
}

const DETAIL: LegalDocumentDetail = {
  id: "doc-1",
  title: "Izin reklame",
  documentType: "IZIN",
  categoryId: "cat-1",
  categoryName: "Perizinan",
  isConfidential: false,
  documentNumber: "IZ/01",
  partyName: "Dinas PMPTSP",
  endDate: "2026-12-31T00:00:00.000Z",
  status: "AKTIF",
  picName: "Budi",
  nextDeadline: null,
  startDate: "2026-01-01T00:00:00.000Z",
  terminatedAt: null,
  terminationReason: null,
  value: "2500000.00",
  currency: "IDR",
  paymentScheme: "TAHUNAN",
  guaranteeDescription: null,
  guaranteeEndDate: null,
  isAutoRenew: true,
  noticePeriodDays: 30,
  penaltyNotes: null,
  disputeResolution: null,
  notes: null,
  fileName: "izin.pdf",
  fileContentType: "application/pdf",
  picUserId: "user-1",
  endorsementId: null,
  previousDocumentId: null,
  renewedById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  obligations: [
    {
      id: "ob-1",
      description: "Bayar retribusi",
      dueDate: "2026-03-01T00:00:00.000Z",
      recurrence: "YEARLY",
      nextDueDate: "2027-03-01T00:00:00.000Z",
    },
  ],
  deadlines: [],
};

describe("normalizeMoneyInput", () => {
  it("menerima gaya Indonesia dan titik desimal", () => {
    expect(normalizeMoneyInput("1.500.000")).toBe("1500000");
    expect(normalizeMoneyInput("Rp 1.500.000,50")).toBe("1500000.50");
    expect(normalizeMoneyInput("1500000.5")).toBe("1500000.5");
    expect(normalizeMoneyInput("  ")).toBeNull();
  });
});

describe("buildLegalPayload", () => {
  it("mengirim isian opsional kosong sebagai null dan jenis hanya saat tambah", () => {
    const payload = buildLegalPayload(buildValues(), "create");

    expect(payload).toMatchObject({
      title: "Kontrak sewa tower",
      documentType: "KONTRAK",
      categoryId: null,
      partyName: null,
      value: null,
      noticePeriodDays: null,
      obligations: [],
    });
    expect(buildLegalPayload(buildValues(), "edit")).not.toHaveProperty(
      "documentType",
    );
  });

  it("mengonversi angka dan membuang baris kewajiban kosong", () => {
    const payload = buildLegalPayload(
      buildValues({
        noticePeriodDays: "30",
        value: "1.000.000",
        obligations: [
          { description: " Bayar PBB ", dueDate: "2026-11-01", recurrence: "YEARLY" },
          { description: "", dueDate: "", recurrence: "NONE" },
        ],
      }),
      "create",
    );

    expect(payload.noticePeriodDays).toBe(30);
    expect(payload.value).toBe("1000000");
    expect(payload.obligations).toEqual([
      { description: "Bayar PBB", dueDate: "2026-11-01", recurrence: "YEARLY" },
    ]);
  });
});

describe("formValuesFromDetail", () => {
  it("mengisi formulir ubah dari detail", () => {
    const values = formValuesFromDetail(DETAIL, "edit");

    expect(values).toMatchObject({
      endDate: "2026-12-31",
      startDate: "2026-01-01",
      noticePeriodDays: "30",
      picName: "Budi",
      isAutoRenew: true,
    });
    expect(values.obligations[0]).toEqual({
      description: "Bayar retribusi",
      dueDate: "2027-03-01",
      recurrence: "YEARLY",
    });
  });

  it("mengosongkan masa berlaku untuk perpanjangan", () => {
    const values = formValuesFromDetail(DETAIL, "renew");

    expect(values.startDate).toBe("");
    expect(values.endDate).toBe("");
  });
});

describe("validateLegalForm", () => {
  it("mewajibkan judul dan berkas saat tambah", () => {
    expect(validateLegalForm(buildValues({ title: "ab" }), "create", buildFile())).toMatch(/Judul/);
    expect(validateLegalForm(buildValues(), "create", null)).toBe("Pilih berkas dokumen");
    expect(validateLegalForm(buildValues(), "create", buildFile())).toBeNull();
  });

  it("menolak berkas di luar jenis atau ukuran yang diizinkan", () => {
    expect(validateLegalForm(buildValues(), "create", buildFile("text/plain"))).toMatch(/PDF/);
    expect(
      validateLegalForm(buildValues(), "create", buildFile("image/png", MAX_FILE_BYTES + 1)),
    ).toMatch(/maksimal/);
  });

  it("mewajibkan tanggal berakhir saat perpanjang tanpa berkas baru", () => {
    expect(validateLegalForm(buildValues({ endDate: "" }), "renew", null)).toMatch(/Tanggal berakhir/);
    expect(validateLegalForm(buildValues({ endDate: "2027-12-31" }), "renew", null)).toBeNull();
  });

  it("menolak urutan tanggal terbalik dan kewajiban setengah terisi", () => {
    expect(
      validateLegalForm(
        buildValues({ startDate: "2026-12-01", endDate: "2026-01-01" }),
        "edit",
        null,
      ),
    ).toMatch(/sebelum tanggal mulai/);
    expect(
      validateLegalForm(
        buildValues({
          obligations: [{ description: "Bayar", dueDate: "", recurrence: "NONE" }],
        }),
        "edit",
        null,
      ),
    ).toMatch(/kewajiban/);
  });
});

describe("masa berlaku tanpa batas waktu", () => {
  // Lupa mengisi tanggal tidak boleh sama dengan "memang tidak kedaluwarsa".
  it("menolak dokumen tanpa tanggal berakhir yang tidak dicentang tanpa batas", () => {
    expect(
      validateLegalForm(buildValues({ endDate: "" }), "create", buildFile()),
    ).toBe(MISSING_VALIDITY_MESSAGE);
  });

  it("menerima dokumen tanpa batas waktu dan mengirim endDate null", () => {
    const values = buildValues({ endDate: "2027-01-01", isIndefinite: true });

    expect(validateLegalForm(values, "create", buildFile())).toBeNull();
    expect(buildLegalPayload(values, "create").endDate).toBeNull();
  });

  it("dokumen lama tanpa tanggal berakhir terbaca sebagai tanpa batas saat diubah", () => {
    const values = formValuesFromDetail({ ...DETAIL, endDate: null }, "edit");

    expect(values.isIndefinite).toBe(true);
  });

  it("perpanjangan selalu wajib bertanggal", () => {
    const values = formValuesFromDetail({ ...DETAIL, endDate: null }, "renew");

    expect(values.isIndefinite).toBe(false);
    expect(validateLegalForm(values, "renew", null)).toMatch(/Tanggal berakhir baru/);
  });

  it("jenis korporat bawaannya tanpa batas waktu", () => {
    expect(isIndefiniteByDefault("KORPORAT")).toBe(true);
    expect(isIndefiniteByDefault("IZIN")).toBe(false);
  });
});
