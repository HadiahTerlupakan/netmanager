import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => ({
  apiKeys: [] as Array<string | null>,
  apiData: undefined as unknown,
  // Komponen memanggil useState pertama kali untuk status buka/tutup panel.
  openOnRender: false,
  stateCalls: 0,
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (key: string | null) => {
    ui.apiKeys.push(key);
    return { data: key ? ui.apiData : undefined };
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initial: unknown) => {
      ui.stateCalls += 1;
      if (ui.openOnRender && ui.stateCalls === 1) return [true, () => {}];
      if (ui.openOnRender && ui.stateCalls === 2) {
        return [
          {
            quantities: { "poi-4core": 2000 },
            additions: [
              {
                key: "k1",
                barangId: "b-2core",
                barangName: "Kabel 2 Core",
                quantity: 2000,
                unitPrice: 7000,
              },
            ],
            reason: "Supplier mengganti sebagian",
          },
          () => {},
        ];
      }
      return actual.useState(initial);
    },
  };
});

import {
  buildItemChangePayload,
  canChangePurchaseOrderItems,
  getItemChangeBlocker,
  getMinimumQuantity,
  previewGrandTotal,
  type ChangeableItem,
  type ItemChangeDraft,
} from "@/app/admin/procurement/purchase-orders/[id]/po-item-change";
import { PurchaseOrderItemChangePanel } from "@/app/admin/procurement/purchase-orders/[id]/PurchaseOrderItemChangePanel";

const cable4Core: ChangeableItem = {
  id: "poi-4core",
  quantity: 4000,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  unitPrice: 10_000,
  barang: { id: "b-4core", nama: "Kabel 4 Core" },
};

const splitDraft: ItemChangeDraft = {
  quantities: { "poi-4core": 2000 },
  additions: [
    {
      key: "k1",
      barangId: "b-2core",
      barangName: "Kabel 2 Core",
      quantity: 2000,
      unitPrice: 7_000,
    },
  ],
  reason: "  Supplier mengganti sebagian ke 2 core  ",
};

describe("PO item change helpers", () => {
  it("is offered only while the PO is still open", () => {
    expect(canChangePurchaseOrderItems("ORDERED")).toBe(true);
    expect(canChangePurchaseOrderItems("PARTIAL")).toBe(true);
    expect(canChangePurchaseOrderItems("RECEIVED")).toBe(false);
    expect(canChangePurchaseOrderItems("CANCELLED")).toBe(false);
  });

  it("never lets a line drop below what was received and cancelled", () => {
    expect(getMinimumQuantity(cable4Core)).toBe(1);
    expect(
      getMinimumQuantity({
        ...cable4Core,
        receivedQuantity: 1500,
        cancelledQuantity: 100,
      }),
    ).toBe(1600);
  });

  it("sends only the lines that changed, plus the additions and the trimmed reason", () => {
    const other: ChangeableItem = {
      ...cable4Core,
      id: "poi-ont",
      barang: null,
    };

    expect(buildItemChangePayload([cable4Core, other], splitDraft)).toEqual({
      reason: "Supplier mengganti sebagian ke 2 core",
      changes: [{ id: "poi-4core", quantity: 2000 }],
      additions: [{ barangId: "b-2core", quantity: 2000, unitPrice: 7_000 }],
    });
  });

  it("previews the new grand total with PPN", () => {
    // 20 jt + 14 jt + jasa 1 jt = 35 jt, PPN 11% = 3,85 jt.
    expect(previewGrandTotal([cable4Core], splitDraft, 1_000_000, 11)).toBe(
      38_850_000,
    );
  });

  it("accepts a complete split", () => {
    expect(getItemChangeBlocker([cable4Core], splitDraft)).toBeNull();
  });

  it.each([
    [
      "a quantity below what was received",
      { ...splitDraft, quantities: { "poi-4core": 0 } },
      "Jumlah Kabel 4 Core minimal 1",
    ],
    [
      "an addition without a barang",
      {
        ...splitDraft,
        additions: [{ ...splitDraft.additions[0], barangId: "" }],
      },
      "Pilih barang tambahan",
    ],
    [
      "a barang already on the PO",
      {
        ...splitDraft,
        additions: [{ ...splitDraft.additions[0], barangId: "b-4core" }],
      },
      "Barang tambahan sudah ada di pesanan. Ubah jumlahnya saja",
    ],
    [
      "nothing changed",
      { quantities: {}, additions: [], reason: "apa saja" },
      "Belum ada perubahan",
    ],
    [
      "a missing reason",
      { ...splitDraft, reason: " " },
      "Isi alasan perubahan",
    ],
  ])("blocks saving on %s", (_label, draft, message) => {
    expect(getItemChangeBlocker([cable4Core], draft)).toBe(message);
  });
});

function renderPanel() {
  ui.stateCalls = 0;
  return renderToStaticMarkup(
    <PurchaseOrderItemChangePanel
      poId="po-1"
      items={[cable4Core]}
      jasaSubtotal={0}
      ppnRate={0}
      grandTotal={40_000_000}
      onChanged={async () => undefined}
    />,
  );
}

describe("PurchaseOrderItemChangePanel", () => {
  it("lists the barang the inventory API returns and keeps the chosen one", () => {
    ui.openOnRender = true;
    ui.apiKeys = [];
    ui.apiData = {
      barangs: [
        { id: "b-1core", nama: "Kabel 1 Core" },
        { id: "b-8core", nama: "Kabel 8 Core" },
      ],
    };

    const html = renderPanel();
    ui.openOnRender = false;

    expect(ui.apiKeys).toContain("/api/inventory/barang?limit=100");
    expect(html).toContain("Kabel 1 Core");
    expect(html).toContain("Kabel 8 Core");
    // Tidak ada di hasil pencarian saat ini, tetapi sudah dipilih.
    expect(html).toContain(
      '<option value="b-2core" selected="">Kabel 2 Core</option>',
    );
    expect(html).toContain("Cari barang tambahan");
  });

  it("starts closed behind a button so the PO page reads as before", () => {
    const html = renderToStaticMarkup(
      <PurchaseOrderItemChangePanel
        poId="po-1"
        items={[cable4Core]}
        jasaSubtotal={0}
        ppnRate={0}
        grandTotal={40_000_000}
        onChanged={async () => undefined}
      />,
    );

    expect(html).toContain("Ubah Isi Pesanan");
    expect(html).not.toContain("Alasan perubahan");
  });
});
