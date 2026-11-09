import { describe, expect, it } from "vitest";

import {
  ALL_LINES_REJECTED_MESSAGE,
  buildApprovalPayload,
  buildInitialApprovalDecisions,
  buildRejectPayload,
  describeQuantityChange,
  getApprovalProblems,
  getRejectProblem,
  getSubstituteOptions,
  isLineRejected,
  wasQtyChanged,
  wasSubstituted,
} from "@/app/admin/inventory/restock/approvalUtils";
import type {
  Barang,
  PurchaseRequest,
  RestockApprovalDecisions,
} from "@/app/admin/inventory/restock/types";

const allBarangs: Barang[] = [
  { id: "barang-1", kode: "BRG-1", nama: "Kabel Fiber", satuan: "roll" },
  { id: "barang-2", kode: "BRG-2", nama: "Konektor SC", satuan: "pcs" },
  { id: "barang-3", kode: "BRG-3", nama: "Kabel Dropcore", satuan: "roll" },
  { id: "barang-4", kode: "BRG-4", nama: "Patch Cord", satuan: "pcs" },
];

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "DRAFT",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Rohadim" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      receivedQuantity: 0,
      barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    },
    {
      id: "item-2",
      barangId: "barang-2",
      jumlah: 50,
      receivedQuantity: 0,
      barang: { nama: "Konektor SC", kode: "BRG-2", satuan: "pcs" },
    },
  ],
  jasaItems: [
    {
      id: "jasa-item-1",
      jasaId: "jasa-1",
      jumlah: 2,
      hargaPerUnit: 100,
      totalHarga: 200,
      statusKonfirmasi: "PENDING",
      jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
    },
  ],
};

function decide(
  patch: (decisions: RestockApprovalDecisions) => void,
): RestockApprovalDecisions {
  const decisions = buildInitialApprovalDecisions(request);
  patch(decisions);
  return decisions;
}

function problemsFor(decisions: RestockApprovalDecisions, overallNote = "") {
  return getApprovalProblems({ request, decisions, overallNote, allBarangs });
}

describe("buildInitialApprovalDecisions", () => {
  it("approves every line at its requested quantity, keyed by line id", () => {
    expect(buildInitialApprovalDecisions(request)).toEqual({
      items: {
        "item-1": {
          keputusan: "APPROVED",
          jumlah: 10,
          barangIdPengganti: null,
          catatan: "",
        },
        "item-2": {
          keputusan: "APPROVED",
          jumlah: 50,
          barangIdPengganti: null,
          catatan: "",
        },
      },
      jasaItems: {
        "jasa-item-1": {
          keputusan: "APPROVED",
          jumlah: 2,
          barangIdPengganti: null,
          catatan: "",
        },
      },
    });
  });
});

describe("getApprovalProblems", () => {
  it("has no problems when everything is approved as requested", () => {
    expect(problemsFor(buildInitialApprovalDecisions(request))).toEqual([]);
  });

  it("requires a note for rejected, changed and substituted lines", () => {
    const decisions = decide((d) => {
      d.items["item-1"].keputusan = "REJECTED";
      d.items["item-2"].jumlah = 40;
      d.jasaItems["jasa-item-1"].jumlah = 3;
    });

    expect(problemsFor(decisions)).toEqual([
      "Kabel Fiber: tulis alasan item ini ditolak.",
      "Konektor SC: tulis alasan jumlahnya diubah.",
      "Splicing: tulis alasan jumlahnya diubah.",
    ]);
  });

  it("requires a note when the barang is substituted", () => {
    const decisions = decide((d) => {
      d.items["item-1"].barangIdPengganti = "barang-3";
    });

    expect(problemsFor(decisions)).toEqual([
      "Kabel Fiber: tulis alasan barangnya diganti.",
    ]);
  });

  it("accepts changes once their notes are written", () => {
    const decisions = decide((d) => {
      d.items["item-1"].keputusan = "REJECTED";
      d.items["item-1"].catatan = "Stok masih cukup";
      d.items["item-2"].jumlah = 40;
      d.items["item-2"].catatan = "Cukup 40";
    });

    expect(problemsFor(decisions)).toEqual([]);
  });

  it("requires a whole quantity of at least one for approved lines", () => {
    const decisions = decide((d) => {
      d.items["item-1"].jumlah = 0;
      d.items["item-1"].catatan = "x";
    });

    expect(problemsFor(decisions)).toContain(
      "Kabel Fiber: jumlah yang disetujui harus 1 atau lebih.",
    );
  });

  it("asks to use Tolak Pengajuan when every line is rejected", () => {
    const decisions = decide((d) => {
      for (const decision of [
        ...Object.values(d.items),
        ...Object.values(d.jasaItems),
      ]) {
        decision.keputusan = "REJECTED";
        decision.catatan = "Tidak perlu";
      }
    });

    expect(problemsFor(decisions)).toEqual([ALL_LINES_REJECTED_MESSAGE]);
  });

  it("flags a substitute that duplicates another approved line", () => {
    const decisions = decide((d) => {
      d.items["item-1"].barangIdPengganti = "barang-2";
      d.items["item-1"].catatan = "Ganti";
    });

    expect(problemsFor(decisions)).toEqual([
      "Konektor SC muncul di lebih dari satu baris setelah penggantian. Pilih barang pengganti lain.",
    ]);
  });

  it("allows substituting to the barang of a rejected line", () => {
    const decisions = decide((d) => {
      d.items["item-1"].barangIdPengganti = "barang-2";
      d.items["item-1"].catatan = "Ganti";
      d.items["item-2"].keputusan = "REJECTED";
      d.items["item-2"].catatan = "Dipakai di baris lain";
    });

    expect(problemsFor(decisions)).toEqual([]);
  });

  it("lets two original lines with the same barang through, like the server", () => {
    const duplicateRequest: PurchaseRequest = {
      ...request,
      items: [
        request.items[0],
        { ...request.items[0], id: "item-1b", jumlah: 4 },
      ],
    };

    expect(
      getApprovalProblems({
        request: duplicateRequest,
        decisions: buildInitialApprovalDecisions(duplicateRequest),
        overallNote: "",
        allBarangs,
      }),
    ).toEqual([]);
  });

  it("flags two lines substituted to the same barang", () => {
    const decisions = decide((d) => {
      d.items["item-1"].barangIdPengganti = "barang-4";
      d.items["item-1"].catatan = "Ganti";
      d.items["item-2"].barangIdPengganti = "barang-4";
      d.items["item-2"].catatan = "Ganti";
    });

    expect(problemsFor(decisions)).toEqual([
      "Patch Cord muncul di lebih dari satu baris setelah penggantian. Pilih barang pengganti lain.",
    ]);
  });

  it("limits note lengths like the server", () => {
    const decisions = decide((d) => {
      d.items["item-1"].catatan = "a".repeat(256);
    });

    expect(problemsFor(decisions, "b".repeat(501))).toEqual([
      "Kabel Fiber: catatan paling panjang 255 karakter.",
      "Catatan keputusan paling panjang 500 karakter.",
    ]);
  });
});

describe("getRejectProblem", () => {
  it("requires an overall note to reject", () => {
    expect(getRejectProblem("  ")).toBe(
      "Tulis alasan penolakan di catatan keputusan.",
    );
    expect(getRejectProblem("Anggaran habis")).toBeNull();
  });
});

describe("buildApprovalPayload", () => {
  it("matches the PATCH contract with trimmed notes and optional fields", () => {
    const decisions = decide((d) => {
      d.items["item-1"].jumlah = 8;
      d.items["item-1"].barangIdPengganti = "barang-3";
      d.items["item-1"].catatan = "  Ganti dropcore  ";
      d.items["item-2"].keputusan = "REJECTED";
      d.items["item-2"].jumlah = 0;
      d.items["item-2"].barangIdPengganti = "barang-4";
      d.items["item-2"].catatan = "Tidak perlu";
    });

    expect(buildApprovalPayload(request, decisions, "  Oke  ")).toEqual({
      action: "APPROVE",
      catatan: "Oke",
      items: [
        {
          itemId: "item-1",
          keputusan: "APPROVED",
          jumlah: 8,
          barangIdPengganti: "barang-3",
          catatan: "Ganti dropcore",
        },
        { itemId: "item-2", keputusan: "REJECTED", catatan: "Tidak perlu" },
      ],
      jasaItems: [{ itemId: "jasa-item-1", keputusan: "APPROVED", jumlah: 2 }],
    });
  });

  it("omits the overall note when empty and sends [] for requests without jasa", () => {
    const withoutJasa: PurchaseRequest = { ...request, jasaItems: undefined };
    const payload = buildApprovalPayload(
      withoutJasa,
      buildInitialApprovalDecisions(withoutJasa),
      " ",
    );

    expect(payload).not.toHaveProperty("catatan");
    expect(payload.jasaItems).toEqual([]);
  });

  it("builds a reject payload with the trimmed note", () => {
    expect(buildRejectPayload("  Anggaran habis ")).toEqual({
      action: "REJECT",
      catatan: "Anggaran habis",
    });
  });
});

describe("getSubstituteOptions", () => {
  it("excludes the line's own barang, other lines and other substitutes", () => {
    const withThirdLine: PurchaseRequest = {
      ...request,
      items: [
        ...request.items,
        {
          id: "item-3",
          barangId: "barang-4",
          jumlah: 1,
          receivedQuantity: 0,
          barang: { nama: "Patch Cord", kode: "BRG-4", satuan: "pcs" },
        },
      ],
    };
    const decisions = buildInitialApprovalDecisions(withThirdLine);
    decisions.items["item-3"].barangIdPengganti = "barang-3";

    expect(
      getSubstituteOptions(allBarangs, withThirdLine, decisions, "item-1"),
    ).toEqual([]);
    expect(
      getSubstituteOptions(allBarangs, withThirdLine, decisions, "item-3").map(
        (option) => option.value,
      ),
    ).toEqual(["barang-3"]);
  });

  it("offers the barang of a rejected line", () => {
    const decisions = decide((d) => {
      d.items["item-2"].keputusan = "REJECTED";
    });

    expect(
      getSubstituteOptions(allBarangs, request, decisions, "item-1"),
    ).toEqual([
      { value: "barang-2", label: "Konektor SC", subLabel: "BRG-2 • pcs" },
      { value: "barang-3", label: "Kabel Dropcore", subLabel: "BRG-3 • roll" },
      { value: "barang-4", label: "Patch Cord", subLabel: "BRG-4 • pcs" },
    ]);
  });
});

describe("display helpers", () => {
  const line = request.items[0];

  it("detects rejected, quantity-changed and substituted lines", () => {
    expect(isLineRejected({ ...line, statusApproval: "REJECTED" })).toBe(true);
    expect(isLineRejected({ ...line, statusApproval: "PENDING" })).toBe(false);
    expect(wasQtyChanged({ ...line, jumlahDiminta: 12 })).toBe(true);
    expect(wasQtyChanged({ ...line, jumlahDiminta: null })).toBe(false);
    expect(wasSubstituted({ ...line, barangIdDiminta: "barang-9" })).toBe(true);
    expect(wasSubstituted({ ...line, barangIdDiminta: null })).toBe(false);
  });

  it("describes the direction of a quantity change", () => {
    expect(describeQuantityChange(10, 12, "roll")).toBe(
      "Naik 2 roll dari yang diajukan",
    );
    expect(describeQuantityChange(10, 7, "roll")).toBe(
      "Turun 3 roll dari yang diajukan",
    );
    expect(describeQuantityChange(10, 10, "roll")).toBeNull();
  });
});
