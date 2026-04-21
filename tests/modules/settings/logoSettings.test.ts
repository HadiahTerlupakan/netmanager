import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAccess,
  mockConvertAndSaveImage,
  mockGetR2Settings,
  mockIsImageFile,
  mockSaveFile,
} = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockConvertAndSaveImage: vi.fn(),
  mockGetR2Settings: vi.fn(),
  mockIsImageFile: vi.fn(),
  mockSaveFile: vi.fn(),
}));

import { getTenantIdFromContext } from "../../../lib/tenant-context";
import { SettingsRepository } from "../../../modules/settings/repositories/SettingsRepository";
import {
  deleteLogo,
  getLogoSettings,
  uploadLogo,
} from "../../../modules/settings/services/logoSettings";

vi.mock("fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    access: mockAccess,
  };
});

vi.mock("../../../lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(),
}));

vi.mock("../../../modules/settings/repositories/SettingsRepository", () => ({
  SettingsRepository: {
    findManyByKeys: vi.fn(),
    upsertMany: vi.fn(),
    deleteManyByKeys: vi.fn(),
  },
}));

vi.mock("../../../lib/utils/image-upload", () => ({
  convertAndSaveImage: mockConvertAndSaveImage,
  isImageFile: mockIsImageFile,
  saveFile: mockSaveFile,
}));

vi.mock("../../../lib/utils/r2-client", () => ({
  getR2Settings: mockGetR2Settings,
}));

describe("logoSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsImageFile.mockReturnValue(true);
    mockGetR2Settings.mockResolvedValue(null);
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([]);
    vi.mocked(SettingsRepository.upsertMany).mockResolvedValue();
    vi.mocked(SettingsRepository.deleteManyByKeys).mockResolvedValue();
  });

  it("menyimpan logo aplikasi tenant dengan format file asli tanpa konversi webp", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });

    mockSaveFile.mockResolvedValue(
      "https://cdn.example.com/uploads/logos/logo-aplikasi.png",
    );
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    await expect(uploadLogo("aplikasi", file)).resolves.toBe(
      "https://cdn.example.com/uploads/logos/logo-aplikasi.png",
    );

    expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
      ["LOGO_APLIKASI"],
      "tenant-1",
    );
    expect(mockSaveFile).toHaveBeenCalledWith(
      file,
      expect.stringContaining("public/uploads/logos"),
      "logo-aplikasi.png",
      "logos",
    );
    expect(mockConvertAndSaveImage).not.toHaveBeenCalled();
    expect(SettingsRepository.upsertMany).toHaveBeenCalledWith([
      {
        key: "LOGO_APLIKASI",
        value: "https://cdn.example.com/uploads/logos/logo-aplikasi.png",
        description: "Logo utama aplikasi",
        encrypted: false,
        tenantId: "tenant-1",
      },
    ]);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("menyimpan logo landing page dengan key, deskripsi, dan nama file yang benar", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });

    mockSaveFile.mockResolvedValue(
      "https://cdn.example.com/uploads/logos/logo-landing-page.png",
    );
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    await expect(uploadLogo("landing", file)).resolves.toBe(
      "https://cdn.example.com/uploads/logos/logo-landing-page.png",
    );

    expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
      ["LOGO_LANDING_PAGE"],
      "tenant-1",
    );
    expect(mockSaveFile).toHaveBeenCalledWith(
      file,
      expect.stringContaining("public/uploads/logos"),
      "logo-landing-page.png",
      "logos",
    );
    expect(SettingsRepository.upsertMany).toHaveBeenCalledWith([
      {
        key: "LOGO_LANDING_PAGE",
        value: "https://cdn.example.com/uploads/logos/logo-landing-page.png",
        description: "Logo khusus landing page",
        encrypted: false,
        tenantId: "tenant-1",
      },
    ]);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("mengambil logo settings berdasarkan tenant aktif", async () => {
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
      {
        key: "LOGO_APLIKASI",
        value: "/uploads/logos/logo-aplikasi.png",
        encrypted: false,
      },
      {
        key: "LOGO_INVOICE",
        value: "/uploads/logos/logo-invoice.png",
        encrypted: false,
      },
      {
        key: "LOGO_LANDING_PAGE",
        value: "/uploads/logos/logo-landing-page.png",
        encrypted: false,
      },
    ]);

    await expect(getLogoSettings()).resolves.toEqual({
      logoInvoice: "/uploads/logos/logo-invoice.png",
      logoAplikasi: "/uploads/logos/logo-aplikasi.png",
      logoLandingPage: "/uploads/logos/logo-landing-page.png",
    });

    expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
      ["LOGO_INVOICE", "LOGO_APLIKASI", "LOGO_LANDING_PAGE"],
      "tenant-1",
    );
  });

  it("mengubah path logo legacy lokal menjadi URL publik R2 saat konfigurasi tersedia", async () => {
    mockGetR2Settings.mockResolvedValue({
      accountId: "acc-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
      bucketName: "bucket-1",
      publicUrl: "https://cdn.radpro.id",
      enabled: true,
    });
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
      {
        key: "LOGO_APLIKASI",
        value: "/uploads/logos/logo-aplikasi.png",
        encrypted: false,
      },
      {
        key: "LOGO_INVOICE",
        value: "/uploads/logos/logo-invoice.png",
        encrypted: false,
      },
      {
        key: "LOGO_LANDING_PAGE",
        value: "/uploads/logos/logo-landing-page.png",
        encrypted: false,
      },
    ]);

    await expect(getLogoSettings()).resolves.toEqual({
      logoInvoice: "https://cdn.radpro.id/uploads/logos/logo-invoice.png",
      logoAplikasi: "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
      logoLandingPage:
        "https://cdn.radpro.id/uploads/logos/logo-landing-page.png",
    });
  });

  it("menghapus logo tenant aktif", async () => {
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
      {
        key: "LOGO_APLIKASI",
        value: "/uploads/logos/logo-aplikasi.png",
        encrypted: false,
      },
    ]);

    await deleteLogo("aplikasi");

    expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
      ["LOGO_APLIKASI"],
      "tenant-1",
    );
    expect(SettingsRepository.deleteManyByKeys).toHaveBeenCalledWith(
      ["LOGO_APLIKASI"],
      "tenant-1",
    );
  });
});
