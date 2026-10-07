import PizZip from "pizzip";
import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentValues,
  formatAchievementRatio,
  formatLicenseDate,
  formatManualAchievement,
  type OperatorProfile,
} from "@/modules/regulatory/domain/self-assessment-document";
import { fillDocxTemplate } from "@/modules/regulatory/services/docx-template";
import { SelfAssessmentDocumentService } from "@/modules/regulatory/services/SelfAssessmentDocumentService";
import { selfAssessmentDocumentFormSchema } from "@/modules/regulatory/validators/self-assessment.validator";

const PROFILE: OperatorProfile = {
  operatorName: "PT Surya Bestari Lestari",
  licenseType: "Jaringan Tetap Lokal Berbasis Packet Switched",
  operatorAddress: "Jl. Raya Cianjur No. 10",
  licenseNumber: "1234/2024",
  licenseDate: "2024-03-12",
  licenseAttachmentUrl: "https://drive.example/izin",
  signingCity: "Cianjur",
  directorName: "Budi Santoso",
};

const documentText = (buffer: Buffer) =>
  new PizZip(buffer)
    .file("word/document.xml")!
    .asText()
    .replace(/<[^>]+>/g, "");

describe("format nilai dokumen", () => {
  it("rasio sistem & isian manual jadi persen Indonesia; kosong jadi '-'", () => {
    expect(formatAchievementRatio(0.984)).toBe("98,40%");
    expect(formatAchievementRatio(null)).toBe("-");
    expect(formatManualAchievement("99.5")).toBe("99,50%");
    expect(formatManualAchievement("99,62")).toBe("99,62%");
    expect(formatManualAchievement("")).toBe("-");
    expect(formatLicenseDate("2024-03-12")).toBe("12 Maret 2024");
  });

  it("kop berisi nama kapital + kontak; tanggal tanda tangan WIB", () => {
    const values = buildDocumentValues({
      scheme: "JARTAPLOK_PS",
      year: 2026,
      profile: PROFILE,
      yearly: {
        manualAchievements: { availability: "99,7" },
        supportingLinks: { restoration: "https://x" },
      },
      computed: { newInstallation: 0.984, restoration: null },
      letterheadContact: "Jl. Raya Cianjur No. 10 · 0812",
      signingDate: new Date("2026-10-04T18:00:00Z"),
    });

    expect(values).toMatchObject({
      tahun: "2026",
      kop_nama: "PT SURYA BESTARI LESTARI\nJl. Raya Cianjur No. 10 · 0812",
      pasang_baru: "98,40%",
      pemulihan: "-",
      availability: "99,70%",
      link_pemulihan: "https://x",
      link_pasang_baru: "",
      tanggal_tanda_tangan: "5 Oktober 2026",
    });
  });
});

describe("template Word Komdigi", () => {
  it("semua penanda terisi; teks asli template tetap ada", async () => {
    const values = buildDocumentValues({
      scheme: "JARTAPLOK_PS",
      year: 2026,
      profile: PROFILE,
      yearly: { manualAchievements: {}, supportingLinks: {} },
      computed: { newInstallation: 0.984, restoration: 0.9318 },
      letterheadContact: "Cianjur",
      signingDate: new Date("2026-10-04T03:00:00Z"),
    });

    const text = documentText(
      await fillDocxTemplate("self-assessment-komdigi.docx", values),
    );

    expect(text).not.toMatch(/\{[a-z_]+\}/);
    expect(text).toContain(
      "PELAPORAN KINERJA JARINGAN DAN LAYANAN BERDASARKAN SELF ASSESSMENT",
    );
    expect(text).toContain("PT Surya Bestari Lestari");
    expect(text).toContain("Pencapaian Tahun 2026");
    expect(text).toContain("98,40%");
    expect(text).toContain("93,18%");
    expect(text).toContain("Budi Santoso");
    expect(text).toContain("Materai");
  });
});

describe("SelfAssessmentDocumentService", () => {
  function build(storedProfile: Partial<OperatorProfile> = {}) {
    const emptyProfile = Object.fromEntries(
      Object.keys(PROFILE).map((key) => [key, ""]),
    ) as unknown as OperatorProfile;
    const store = {
      getProfile: vi
        .fn()
        .mockResolvedValue({ ...emptyProfile, ...storedProfile }),
      saveProfile: vi.fn(),
      getYearlyInput: vi
        .fn()
        .mockResolvedValue({ manualAchievements: {}, supportingLinks: {} }),
      saveYearlyInput: vi.fn(),
    };
    const company = {
      getCompanyIdentity: vi.fn().mockResolvedValue({
        name: "PT Dari Pengaturan",
        address: "Alamat Pengaturan",
        phone: "0812",
        email: "a@b.id",
      }),
    };
    const reports = {
      build: vi.fn().mockResolvedValue({
        parameters: [
          { parameter: { key: "PASANG_BARU" }, annual: { ratio: 0.98 } },
          { parameter: { key: "PEMULIHAN_LAYANAN" }, annual: { ratio: null } },
        ],
      }),
    };
    const renderTemplate = vi.fn().mockResolvedValue(Buffer.from("docx"));
    const service = new SelfAssessmentDocumentService(
      store,
      company,
      reports as never,
      renderTemplate,
      () => new Date("2026-10-04T03:00:00Z"),
    );
    return { service, store, renderTemplate };
  }

  it("profil kosong diisi dari Pengaturan Umum & jenis izin baku", async () => {
    const { service } = build();

    const form = await service.getForm(2026, "tenant-1", "JARTAPLOK_PS");

    expect(form.profile).toMatchObject({
      operatorName: "PT Dari Pengaturan",
      operatorAddress: "Alamat Pengaturan",
      licenseType: "Jaringan Tetap Lokal Berbasis Packet Switched",
    });
    expect(form.computed).toEqual({ newInstallation: 0.98, restoration: null });
  });

  it("profil tersimpan diutamakan di atas Pengaturan Umum", async () => {
    const { service } = build({ operatorName: "PT Tersimpan" });

    expect(
      (await service.getForm(2026, "tenant-1", "JARTAPLOK_PS")).profile
        .operatorName,
    ).toBe("PT Tersimpan");
  });

  it("dokumen memakai template Komdigi dengan kop dari alamat + kontak", async () => {
    const { service, renderTemplate } = build();

    await service.renderDocument(2026, "tenant-1", "JARTAPLOK_PS");

    const [fileName, values] = renderTemplate.mock.calls[0];
    expect(fileName).toBe("self-assessment-komdigi.docx");
    expect(values.kop_nama).toBe(
      "PT DARI PENGATURAN\nAlamat Pengaturan · 0812 · a@b.id",
    );
    expect(values.pasang_baru).toBe("98,00%");
  });

  // Tenant bisa memegang dua izin sekaligus; formulir ISP tidak boleh memakai
  // template maupun jenis izin milik Jartaplok.
  it("skema ISP memakai template dan jenis izin sendiri", async () => {
    const { service, renderTemplate, store } = build();

    const form = await service.getForm(2026, "tenant-1", "ISP");
    expect(form.profile.licenseType).toBe("Internet Service Provider");
    expect(store.getProfile).toHaveBeenCalledWith("tenant-1", "ISP");

    await service.renderDocument(2026, "tenant-1", "ISP");
    expect(renderTemplate.mock.calls.at(-1)?.[0]).toBe(
      "self-assessment-isp.docx",
    );
  });

  it("menyimpan isian ke skema yang diminta", async () => {
    const { service, store } = build();
    const isian = {
      profile: {} as never,
      yearly: { manualAchievements: {}, supportingLinks: {} },
    };

    await service.saveForm(2026, "tenant-1", "ISP", isian);

    expect(store.saveProfile).toHaveBeenCalledWith(
      "tenant-1",
      "ISP",
      isian.profile,
    );
    expect(store.saveYearlyInput).toHaveBeenCalledWith(
      "tenant-1",
      "ISP",
      2026,
      isian.yearly,
    );
  });
});

describe("validasi formulir dokumen", () => {
  const valid = {
    profile: { ...PROFILE },
    yearly: {
      manualAchievements: { packetLoss: "1,5" },
      supportingLinks: { latency: "https://x" },
    },
  };

  it("menerima isian lengkap", () => {
    expect(selfAssessmentDocumentFormSchema.safeParse(valid).success).toBe(
      true,
    );
  });

  it.each([
    [
      "persen di atas 100",
      {
        ...valid,
        yearly: { ...valid.yearly, manualAchievements: { latency: "120" } },
      },
    ],
    [
      "link tanpa http",
      {
        ...valid,
        yearly: {
          ...valid.yearly,
          supportingLinks: { latency: "drive.google.com" },
        },
      },
    ],
    [
      "tanggal izin salah",
      { ...valid, profile: { ...PROFILE, licenseDate: "12-03-2024" } },
    ],
  ])("menolak %s", (_label, input) => {
    expect(selfAssessmentDocumentFormSchema.safeParse(input).success).toBe(
      false,
    );
  });
});
