import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByTenant: vi.fn(),
  tenantFindUnique: vi.fn(),
  findActive: vi.fn(),
  getLogoSettings: vi.fn(),
  buildLogoDataUri: vi.fn(),
}));

vi.mock("@/modules/network/isolir/IsolirPageRepository", () => ({
  IsolirPageRepository: { findByTenant: mocks.findByTenant },
}));
vi.mock("@/modules/database", () => ({
  prismaAuth: { tenant: { findUnique: mocks.tenantFindUnique } },
}));
vi.mock("@/modules/finance", () => ({
  getCompanyBankAccountService: () => ({
    listActiveAccounts: mocks.findActive,
  }),
}));
vi.mock("@/modules/settings", () => ({
  getLogoSettings: mocks.getLogoSettings,
}));
vi.mock("@/modules/network/isolir/isolir-logo", () => ({
  buildLogoDataUri: mocks.buildLogoDataUri,
}));

import {
  DEFAULT_MESSAGE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_TITLE,
  resolveIsolirContent,
} from "@/modules/network/isolir/isolir-content";

const emptyPage: Record<string, unknown> = {
  id: "p1",
  tenantId: "t1",
  ispName: null,
  title: null,
  message: null,
  logoUrl: null,
  payments: [],
  whatsappNumber: null,
  whatsappText: null,
  linkLabel: null,
  linkUrl: null,
  contactText: null,
  primaryColor: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findByTenant.mockResolvedValue(null);
  mocks.tenantFindUnique.mockResolvedValue({ name: "Net Jaya" });
  mocks.findActive.mockResolvedValue([
    { bankName: "BCA", accountNumber: "123", accountName: "PT Net Jaya" },
  ]);
  mocks.getLogoSettings.mockResolvedValue({ logoAplikasi: "/uploads/l.png" });
  mocks.buildLogoDataUri.mockResolvedValue("data:image/webp;base64,AAA");
});

describe("resolveIsolirContent", () => {
  it("tenant tanpa IsolirPage memakai default", async () => {
    const content = await resolveIsolirContent("t1");

    expect(content).toEqual({
      ispName: "Net Jaya",
      title: DEFAULT_TITLE,
      message: DEFAULT_MESSAGE,
      logoDataUri: "data:image/webp;base64,AAA",
      payments: [{ label: "BCA", number: "123", holder: "PT Net Jaya" }],
      whatsapp: null,
      link: {
        label: "Bayar Tagihan",
        url: "https://pelanggan.radpro.id/tagihan",
      },
      contactText: null,
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
    expect(mocks.findActive).toHaveBeenCalledWith("t1");
    expect(mocks.buildLogoDataUri).toHaveBeenCalledWith("/uploads/l.png");
  });

  it("isian tenant mengalahkan default", async () => {
    mocks.findByTenant.mockResolvedValue({
      ...emptyPage,
      ispName: "Nama Sendiri",
      title: "Judul",
      message: "Pesan",
      logoUrl: "https://x.test/logo.png",
      payments: [{ label: "DANA", number: "081", holder: "Budi" }],
      linkLabel: "Bayar",
      linkUrl: "https://bayar.test",
      contactText: "Hubungi kantor",
      primaryColor: "#ff0000",
    });

    const content = await resolveIsolirContent("t1");

    expect(content).toMatchObject({
      ispName: "Nama Sendiri",
      title: "Judul",
      message: "Pesan",
      payments: [{ label: "DANA", number: "081", holder: "Budi" }],
      link: { label: "Bayar", url: "https://bayar.test" },
      contactText: "Hubungi kantor",
      primaryColor: "#ff0000",
    });
    expect(mocks.buildLogoDataUri).toHaveBeenCalledWith(
      "https://x.test/logo.png",
    );
    expect(mocks.getLogoSettings).not.toHaveBeenCalled();
  });

  it("router tanpa tenant", async () => {
    const content = await resolveIsolirContent(null);

    expect(content.ispName).toBe("Layanan Internet");
    expect(content.payments).toEqual([]);
    expect(content.logoDataUri).toBeNull();
    expect(mocks.findActive).not.toHaveBeenCalled();
    expect(mocks.getLogoSettings).not.toHaveBeenCalled();
    expect(mocks.findByTenant).toHaveBeenCalledWith(null);
  });

  it("whatsapp hanya bila nomor diisi", async () => {
    mocks.findByTenant.mockResolvedValue({
      ...emptyPage,
      whatsappNumber: "0812 3456-789",
    });
    expect((await resolveIsolirContent("t1")).whatsapp).toEqual({
      number: "628123456789",
      text: "",
    });

    mocks.findByTenant.mockResolvedValue({
      ...emptyPage,
      whatsappNumber: "  ",
      whatsappText: "halo",
    });
    expect((await resolveIsolirContent("t1")).whatsapp).toBeNull();
  });

  it("warna bukan hex 6 digit kembali ke default", async () => {
    mocks.findByTenant.mockResolvedValue({
      ...emptyPage,
      primaryColor: "red;}</style>",
    });
    expect((await resolveIsolirContent("t1")).primaryColor).toBe(
      DEFAULT_PRIMARY_COLOR,
    );
  });
});
