import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Barang,
  Gudang,
  RestockFormItem,
  RestockSetting,
} from "@/app/admin/inventory/restock/types";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock("@/components/ui/SearchableSelect", () => ({
  SearchableSelect: ({ value }: { value: string }) => (
    <div data-searchable-select-value={value} />
  ),
}));

import { RestockFormModal } from "@/app/admin/inventory/restock/RestockFormModal";

const gudangs: Gudang[] = [{ id: "gudang-a", nama: "Gudang A" }];

const barangs: Barang[] = [
  {
    id: "barang-1",
    kode: "BRG-001",
    nama: "Kabel Fiber",
    satuan: "roll",
    minStokDefault: 5,
    stockPerGudang: [
      {
        id: "stock-1",
        barangId: "barang-1",
        gudangId: "gudang-a",
        stok: 2,
        stokBaru: 2,
        stokBekas: 0,
        stokRusak: 0,
      },
    ],
  },
];

const allSettings: RestockSetting[] = [
  {
    id: "setting-1",
    barangId: "barang-1",
    gudangId: "gudang-a",
    minStok: 5,
    maxStok: 10,
  },
];

function renderForm(
  formItems: RestockFormItem[],
  formNotes = "Restock bulanan Site A",
) {
  const onFormItemsChange = vi.fn();
  const markup = renderToStaticMarkup(
    <RestockFormModal
      isOpen={true}
      isEditing={false}
      formGudang="gudang-a"
      onFormGudangChange={vi.fn()}
      formNotes={formNotes}
      onFormNotesChange={vi.fn()}
      formItems={formItems}
      onFormItemsChange={onFormItemsChange}
      gudangs={gudangs}
      barangs={barangs}
      allSettings={allSettings}
      showAllItems={false}
      onShowAllItemsChange={vi.fn()}
      loading={false}
      submitting={false}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  return { markup, onFormItemsChange };
}

describe("RestockFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders per-item keterangan input with the current item note", () => {
    const { markup } = renderForm([
      {
        barangId: "barang-1",
        quantity: 2,
        keterangan: "Untuk ODP baru",
      },
    ]);

    expect(markup).toContain("Keterangan Item");
    expect(markup).toContain("Untuk ODP baru");
    expect(markup).toContain("Catatan khusus barang ini");
  });

  it("marks main catatan / keterangan as required", () => {
    const { markup } = renderForm([{ barangId: "barang-1", quantity: 2 }], "");

    expect(markup).toContain("Catatan / Keterangan wajib diisi");
    expect(markup).toContain("required");
    expect(markup).toContain('aria-invalid="true"');
  });
});
