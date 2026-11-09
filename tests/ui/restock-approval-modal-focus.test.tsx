// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildInitialApprovalDecisions,
  getRejectProblem,
} from "@/app/admin/inventory/restock/approvalUtils";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";
import type { RestockApprovalController } from "@/app/admin/inventory/restock/useRestockApproval";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock("@/components/ui/SearchableSelect", () => ({
  SearchableSelect: (): null => null,
}));

import { RestockApprovalModal } from "@/app/admin/inventory/restock/RestockApprovalModal";

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
  ],
};

function buildController(
  isRejectConfirming: boolean,
): RestockApprovalController {
  const overallNote = "Anggaran habis";
  return {
    request,
    decisions: buildInitialApprovalDecisions(request),
    overallNote,
    setOverallNote: vi.fn(),
    problems: [],
    rejectProblem: getRejectProblem(overallNote),
    isRejectConfirming,
    isSubmitting: false,
    open: vi.fn(),
    close: vi.fn(),
    updateLineDecision: vi.fn(),
    approve: vi.fn(),
    requestReject: vi.fn(),
    cancelReject: vi.fn(),
    reject: vi.fn(),
  };
}

let container: HTMLElement;
let root: Root;

async function renderWith(isRejectConfirming: boolean) {
  await act(async () => {
    root.render(
      <RestockApprovalModal
        approval={buildController(isRejectConfirming)}
        allBarangs={[]}
      />,
    );
  });
}

function focusedText(): string | null | undefined {
  return document.activeElement?.textContent?.trim();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("RestockApprovalModal focus", () => {
  it("moves focus into the reject confirmation and back to Tolak Pengajuan on Kembali", async () => {
    await renderWith(false);

    await renderWith(true);
    expect(focusedText()).toBe("Kembali");

    await renderWith(false);
    expect(focusedText()).toBe("Tolak Pengajuan");
  });
});
