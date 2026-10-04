import { describe, expect, it } from "vitest";

import {
  createBlock,
  findTemplateContentError,
  insertAtSelection,
  listItemsToText,
  MAX_TEMPLATE_BLOCKS,
  moveBlock,
  prepareTemplateContent,
  setBlockText,
  setListText,
  setSignatureText,
  textToListItems,
} from "@/app/admin/legal/template/editor/template-blocks";
import {
  buildPreviewDocument,
  formValuesFromTemplate,
} from "@/app/admin/legal/template/[id]/pakai/template-document-state";
import type { LegalTemplate, TemplateBlock } from "@/app/admin/legal/components/legal-types";

const HEADING: TemplateBlock = { type: "heading", text: "PERJANJIAN" };
const PARAGRAPH: TemplateBlock = { type: "paragraph", text: "Isi" };

describe("moveBlock", () => {
  it("menukar blok dengan tetangganya", () => {
    expect(moveBlock([HEADING, PARAGRAPH], 1, -1)).toEqual([PARAGRAPH, HEADING]);
  });

  it("mengabaikan pemindahan keluar batas", () => {
    const blocks = [HEADING, PARAGRAPH];
    expect(moveBlock(blocks, 0, -1)).toBe(blocks);
    expect(moveBlock(blocks, 1, 1)).toBe(blocks);
  });
});

describe("insertAtSelection", () => {
  it("menyisipkan di kursor dan mengganti seleksi", () => {
    expect(insertAtSelection("Halo dunia", "{{pihak.nama}}", 5, 10)).toEqual({
      value: "Halo {{pihak.nama}}",
      cursor: 19,
    });
  });
});

describe("pengubah blok", () => {
  it("mengubah judul pasal tanpa menyentuh isinya", () => {
    const article: TemplateBlock = { type: "article", title: "Lama", text: "Isi" };
    expect(setBlockText(article, "title", "Baru")).toEqual({
      type: "article",
      title: "Baru",
      text: "Isi",
    });
  });

  it("mengabaikan field yang tidak dimiliki blok", () => {
    expect(setBlockText(HEADING, "title", "x")).toBe(HEADING);
  });

  it("memecah teks daftar per baris dan mempertahankan baris kosong saat diedit", () => {
    const list = setListText(createBlock("list"), "Satu\n");
    expect(list).toEqual({ type: "list", items: ["Satu", ""] });
    expect(listItemsToText(textToListItems("a\nb"))).toBe("a\nb");
  });

  it("mengubah satu sisi tanda tangan", () => {
    const updated = setSignatureText(createBlock("signatures"), "right", "name", "Budi");
    expect(updated).toMatchObject({ right: { label: "PIHAK KEDUA", name: "Budi" } });
  });
});

describe("prepareTemplateContent", () => {
  it("membuang butir daftar kosong", () => {
    const result = prepareTemplateContent([{ type: "list", items: ["A", " ", ""] }]);
    expect(result).toEqual({ content: [{ type: "list", items: ["A"] }], error: null });
  });

  it("menolak daftar tanpa butir dan isi kosong", () => {
    expect(prepareTemplateContent([{ type: "list", items: [""] }]).error).toMatch(/Blok 1/);
    expect(findTemplateContentError([])).not.toBeNull();
  });

  it("menolak isi melebihi batas blok", () => {
    const blocks = Array.from({ length: MAX_TEMPLATE_BLOCKS + 1 }, () => PARAGRAPH);
    expect(findTemplateContentError(blocks)).toMatch(String(MAX_TEMPLATE_BLOCKS));
  });
});

describe("template-document-state", () => {
  const TEMPLATE: LegalTemplate = {
    id: "tpl-1",
    name: "Surat Kuasa",
    documentType: "KORPORAT",
    category: { id: "cat-1", name: "Kuasa" },
    content: [HEADING],
    isBuiltIn: true,
    isActive: true,
    updatedAt: "2026-10-04T00:00:00.000Z",
  };

  it("mengisi formulir awal dari template", () => {
    const values = formValuesFromTemplate(TEMPLATE);
    expect(values).toMatchObject({
      title: "Surat Kuasa",
      documentType: "KORPORAT",
      categoryId: "cat-1",
      isIndefinite: true,
    });
  });

  it("hanya meneruskan field pratinjau dengan aturan payload biasa", () => {
    const preview = buildPreviewDocument({
      ...formValuesFromTemplate(TEMPLATE),
      value: "1.500.000",
      notes: "tidak ikut",
    });
    expect(preview).toEqual({
      title: "Surat Kuasa",
      documentNumber: null,
      partyName: null,
      partyType: null,
      partyId: null,
      startDate: null,
      endDate: null,
      value: "1500000",
    });
  });
});
