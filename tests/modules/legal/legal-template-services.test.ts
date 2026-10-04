import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: async () => ({ tenantId: "tenant-1", isSuperAdmin: false }),
}));

import { DEFAULT_LEGAL_TEMPLATES } from "@/modules/legal/domain/default-templates";
import type { TemplateBlock } from "@/modules/legal/domain/template-content";
import { LegalTemplateDocumentService } from "@/modules/legal/services/LegalTemplateDocumentService";
import {
  type Letterhead,
  LegalTemplateRenderer,
} from "@/modules/legal/services/LegalTemplateRenderer";
import { LegalTemplateService } from "@/modules/legal/services/LegalTemplateService";

const ACCESS = { canViewConfidential: false };
const LETTERHEAD: Letterhead = {
  companyName: "PT RadPro Net",
  address: "Cianjur",
  phone: "0812",
  email: "legal@radpro.id",
  logo: null,
};

function buildTemplateRepository() {
  return {
    countTemplates: vi.fn().mockResolvedValue(3),
    createTemplates: vi.fn(),
    listTemplates: vi.fn().mockResolvedValue([]),
    findTemplateById: vi.fn().mockResolvedValue(null),
    createTemplate: vi.fn(async (input) => ({ id: "tpl-1", ...input })),
    updateTemplate: vi.fn(async (id, patch) => ({ id, ...patch })),
  };
}

describe("LegalTemplateService", () => {
  let repository: ReturnType<typeof buildTemplateRepository>;
  const categories = { assertUsable: vi.fn() };
  const service = () => new LegalTemplateService(repository, categories as never);

  beforeEach(() => {
    repository = buildTemplateRepository();
    categories.assertUsable.mockReset();
  });

  it("membuat template bawaan saat tenant belum punya template", async () => {
    repository.countTemplates.mockResolvedValue(0);

    await service().list();

    const created = repository.createTemplates.mock.calls[0][0] as Array<{
      tenantId: string;
      isBuiltIn: boolean;
    }>;
    expect(created).toHaveLength(DEFAULT_LEGAL_TEMPLATES.length);
    expect(created.every((item) => item.tenantId === "tenant-1" && item.isBuiltIn)).toBe(true);
  });

  it("tidak membuat ulang template bawaan bila sudah ada", async () => {
    await service().list();

    expect(repository.createTemplates).not.toHaveBeenCalled();
  });

  it("template milik tenant lain / tidak ada dijawab 404", async () => {
    await expect(service().getById("tpl-x")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("kategori template diperiksa sesuai jenis dokumen; tenant diisi dari konteks", async () => {
    await service().create(
      { name: "PKS Vendor", documentType: "KONTRAK", categoryId: "cat-1", content: [] },
      ACCESS,
    );

    expect(categories.assertUsable).toHaveBeenCalledWith("cat-1", "KONTRAK", ACCESS);
    expect(repository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", name: "PKS Vendor" }),
    );
  });

  it("mengubah kategori memakai jenis dokumen template yang tersimpan", async () => {
    repository.findTemplateById.mockResolvedValue({ id: "tpl-1", documentType: "IZIN" });

    await service().update("tpl-1", { categoryId: "cat-2" }, ACCESS);

    expect(categories.assertUsable).toHaveBeenCalledWith("cat-2", "IZIN", ACCESS);
    expect(repository.updateTemplate).toHaveBeenCalledWith("tpl-1", { categoryId: "cat-2" });
  });
});

describe("LegalTemplateDocumentService", () => {
  const content: TemplateBlock[] = [
    { type: "paragraph", text: "{{perusahaan.nama}} dengan {{pihak.nama}} di {{pihak.alamat}}" },
  ];

  function build(party: object | null = null) {
    const renderer = { render: vi.fn().mockResolvedValue(Buffer.from("%PDF")) };
    const parties = { findById: vi.fn().mockResolvedValue(party) };
    const documents = { create: vi.fn().mockResolvedValue({ id: "doc-1" }) };
    const service = new LegalTemplateDocumentService(
      renderer as never,
      { getLetterhead: async () => LETTERHEAD },
      parties,
      documents as never,
    );
    return { service, renderer, parties, documents };
  }

  const renderedText = (renderer: { render: ReturnType<typeof vi.fn> }) =>
    (renderer.render.mock.calls[0][0] as TemplateBlock[]).map((block) =>
      "text" in block ? block.text : "",
    )[0];

  it("pihak tertaut memberi alamat dari modul asalnya", async () => {
    const { service, renderer, parties } = build({
      name: "CV Maju",
      address: "Jl. Mawar 3",
      phone: null,
    });

    await service.render(content, { partyType: "RESELLER", partyId: "rs-1" });

    expect(parties.findById).toHaveBeenCalledWith("RESELLER", "rs-1");
    expect(renderedText(renderer)).toBe("PT RadPro Net dengan CV Maju di Jl. Mawar 3");
    expect(renderer.render.mock.calls[0][1]).toBe(LETTERHEAD);
  });

  it("pihak teks bebas hanya mengisi nama; alamat tetap titik-titik", async () => {
    const { service, renderer, parties } = build();

    await service.render(content, { partyName: "Bpk. Ahmad" });

    expect(parties.findById).not.toHaveBeenCalled();
    expect(renderedText(renderer)).toBe(
      "PT RadPro Net dengan Bpk. Ahmad di ........................",
    );
  });

  it("dokumen dari template disimpan lewat LegalDocumentService sebagai PDF", async () => {
    const { service, documents } = build();
    const payload = { title: "PKS CV Maju", documentType: "KONTRAK" } as never;
    const context = { userId: "user-1", access: ACCESS };

    await service.createDocument(content, payload, context);

    expect(documents.create).toHaveBeenCalledWith(
      payload,
      { buffer: Buffer.from("%PDF"), fileName: "PKS CV Maju.pdf", contentType: "application/pdf" },
      context,
    );
  });
});

describe("LegalTemplateRenderer", () => {
  it("menghasilkan PDF valid dan berpindah halaman untuk isi panjang", async () => {
    const longContent: TemplateBlock[] = [
      { type: "heading", text: "PERJANJIAN" },
      ...Array.from({ length: 30 }, (_, index): TemplateBlock => ({
        type: "article",
        title: `Ketentuan ${index + 1}`,
        text: "Para pihak sepakat **mematuhi** ketentuan ini. ".repeat(6),
      })),
      {
        type: "signatures",
        left: { label: "PIHAK PERTAMA", name: "PT RadPro Net" },
        right: { label: "PIHAK KEDUA", name: "CV Maju" },
      },
    ];

    const pdf = await new LegalTemplateRenderer().render(longContent, LETTERHEAD);
    const parsed = await PDFDocument.load(pdf);

    expect(parsed.getPageCount()).toBeGreaterThan(1);
  });

  it("karakter di luar WinAnsi tidak menggagalkan render", async () => {
    const pdf = await new LegalTemplateRenderer().render(
      [{ type: "paragraph", text: "Kontrak ✓ 中文 — selesai" }],
      LETTERHEAD,
    );

    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});
