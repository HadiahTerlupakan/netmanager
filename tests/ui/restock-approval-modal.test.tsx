import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  buildInitialApprovalDecisions,
  getApprovalProblems,
  getRejectProblem,
} from "@/app/admin/inventory/restock/approvalUtils";
import type {
  Barang,
  PurchaseRequest,
  RestockApprovalDecisions,
} from "@/app/admin/inventory/restock/types";
import type { RestockApprovalController } from "@/app/admin/inventory/restock/useRestockApproval";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/ui/SearchableSelect", () => ({
  SearchableSelect: ({
    options,
    ariaLabel,
  }: {
    options: Array<{ value: string; label: string }>;
    ariaLabel?: string;
  }) => (
    <ul data-testid="substitute-options" aria-label={ariaLabel}>
      {options.map((option) => (
        <li key={option.value}>{option.label}</li>
      ))}
    </ul>
  ),
}));

import { RestockApprovalModal } from "@/app/admin/inventory/restock/RestockApprovalModal";

const allBarangs: Barang[] = [
  { id: "barang-1", kode: "BRG-1", nama: "Kabel Fiber", satuan: "roll" },
  { id: "barang-2", kode: "BRG-2", nama: "Konektor SC", satuan: "pcs" },
  { id: "barang-3", kode: "BRG-3", nama: "Kabel Dropcore", satuan: "roll" },
];

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "DRAFT",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Rohadim" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  keterangan: "Rollout Depok",
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

function buildController(
  overrides: Partial<RestockApprovalController> & {
    decisions?: RestockApprovalDecisions;
  } = {},
): RestockApprovalController {
  const decisions =
    overrides.decisions ?? buildInitialApprovalDecisions(request);
  const overallNote = overrides.overallNote ?? "";
  return {
    request,
    decisions,
    overallNote,
    setOverallNote: vi.fn(),
    problems: getApprovalProblems({
      request,
      decisions,
      overallNote,
      allBarangs,
    }),
    rejectProblem: getRejectProblem(overallNote),
    isRejectConfirming: false,
    isSubmitting: false,
    open: vi.fn(),
    close: vi.fn(),
    updateLineDecision: vi.fn(),
    approve: vi.fn(),
    requestReject: vi.fn(),
    cancelReject: vi.fn(),
    reject: vi.fn(),
    ...overrides,
  };
}

function renderModal(controller = buildController()) {
  return renderToStaticMarkup(
    <RestockApprovalModal approval={controller} allBarangs={allBarangs} />,
  );
}

describe("RestockApprovalModal", () => {
  it("shows the request header and one decision row per barang and jasa", () => {
    const markup = renderModal();

    expect(markup).toContain("Keputusan Pengajuan");
    expect(markup).toContain("PR-001");
    expect(markup).toContain("Rohadim");
    expect(markup).toContain("Gudang A");
    expect(markup).toContain("Rollout Depok");
    expect(markup).toContain('aria-label="Keputusan untuk Kabel Fiber"');
    expect(markup).toContain('aria-label="Keputusan untuk Konektor SC"');
    expect(markup).toContain('aria-label="Keputusan untuk Splicing"');
  });

  it("labels the decision toggle with the item name and pressed state", () => {
    const markup = renderModal();

    expect(markup).toMatch(
      /aria-pressed="true"[^>]*aria-label="Setujui Kabel Fiber"/,
    );
    expect(markup).toMatch(
      /aria-pressed="false"[^>]*aria-label="Tolak Kabel Fiber"/,
    );
  });

  it("prefills the approved quantity and shows the requested amount", () => {
    const markup = renderModal();

    expect(markup).toMatch(
      /aria-label="Jumlah Kabel Fiber disetujui"[^>]*value="10"/,
    );
    expect(markup).toContain("Diajukan: 10 roll");
  });

  it("offers substitution for barang only", () => {
    const markup = renderModal();

    expect(markup).toContain("Ganti barang Kabel Fiber");
    expect(markup).not.toContain("Ganti barang Splicing");
  });

  it("marks a changed line's note as required and lists the problem", () => {
    const decisions = buildInitialApprovalDecisions(request);
    decisions.items["item-1"].jumlah = 12;
    const markup = renderModal(buildController({ decisions }));

    expect(markup).toContain("Naik 2 roll dari yang diajukan");
    expect(markup).toMatch(
      /aria-label="Catatan keputusan Kabel Fiber"[^>]*aria-required="true"[^>]*aria-invalid="true"/,
    );
    expect(markup).toContain("Belum bisa disetujui:");
    expect(markup).toContain("Kabel Fiber: tulis alasan jumlahnya diubah.");
    expect(markup).toMatch(
      /disabled=""[^>]*aria-disabled="true"[^>]*aria-describedby="restock-approval-problems"/,
    );
  });

  it("shows substitute options without other lines' barang", () => {
    const decisions = buildInitialApprovalDecisions(request);
    decisions.items["item-1"].barangIdPengganti = "barang-3";
    decisions.items["item-1"].catatan = "Ganti";
    const markup = renderModal(buildController({ decisions }));

    expect(markup).toContain("Diganti dari Kabel Fiber");
    expect(markup).toContain("Batalkan penggantian Kabel Fiber");
    const options = markup.match(
      /<ul data-testid="substitute-options"[^>]*>(.*?)<\/ul>/,
    )?.[1];
    expect(options).toContain("Kabel Dropcore");
    expect(options).not.toContain("Konektor SC");
  });

  it("hides quantity and substitution for a rejected line", () => {
    const decisions = buildInitialApprovalDecisions(request);
    decisions.items["item-1"].keputusan = "REJECTED";
    const markup = renderModal(buildController({ decisions }));

    expect(markup).not.toContain('aria-label="Jumlah Kabel Fiber disetujui"');
    expect(markup).not.toContain("Ganti barang Kabel Fiber");
    expect(markup).toContain("Kabel Fiber: tulis alasan item ini ditolak.");
  });

  it("explains that rejecting needs an overall note", () => {
    const markup = renderModal();

    expect(markup).toContain(
      "Tolak Pengajuan: Tulis alasan penolakan di catatan keputusan.",
    );
    expect(markup).toContain('for="restock-approval-note"');
  });

  it("asks for confirmation inside the modal before rejecting", () => {
    const markup = renderModal(
      buildController({
        overallNote: "Anggaran habis",
        isRejectConfirming: true,
      }),
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("Ya, Tolak Pengajuan");
    expect(markup).not.toContain("</svg> Setujui</button>");
  });

  it("locks inputs while submitting", () => {
    const markup = renderModal(buildController({ isSubmitting: true }));

    expect(markup).toContain("Menyimpan...");
    expect(markup).toMatch(
      /disabled=""[^>]*aria-label="Jumlah Kabel Fiber disetujui"/,
    );
  });
  it("shows the original barang on a rejected line that had a substitute picked", () => {
    const decisions = buildInitialApprovalDecisions(request);
    decisions.items["item-1"] = {
      ...decisions.items["item-1"],
      keputusan: "REJECTED",
      barangIdPengganti: "barang-3",
      catatan: "Tidak perlu",
    };

    const markup = renderModal(buildController({ decisions }));

    expect(markup).not.toContain("Kabel Dropcore");
    expect(markup).not.toContain("Diganti dari Kabel Fiber");
    expect(markup).toContain("Kabel Fiber");
  });

  it("names the substitute picker after its line", () => {
    const decisions = buildInitialApprovalDecisions(request);
    decisions.items["item-1"] = {
      ...decisions.items["item-1"],
      barangIdPengganti: "barang-3",
      catatan: "Ganti",
    };

    const markup = renderModal(buildController({ decisions }));

    expect(markup).toContain('aria-label="Barang pengganti untuk Kabel Fiber"');
  });
});
