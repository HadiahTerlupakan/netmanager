import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAccess, mockConvertAndSaveImage, mockIsImageFile, mockSaveFile } =
  vi.hoisted(() => ({
    mockAccess: vi.fn(),
    mockConvertAndSaveImage: vi.fn(),
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

describe("logoSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsImageFile.mockReturnValue(true);
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
    ]);

    await expect(getLogoSettings()).resolves.toEqual({
      logoInvoice: "/uploads/logos/logo-invoice.png",
      logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    });

    expect(SettingsRepository.findManyByKeys).toHaveBeenCalledWith(
      ["LOGO_INVOICE", "LOGO_APLIKASI"],
      "tenant-1",
    );
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
