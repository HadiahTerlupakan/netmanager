// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  responses: new Map<string, unknown>(),
  mutate: vi.fn(),
  fetchWithHandling: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (url: string | null) => ({
    data: url ? mocks.responses.get(url.split("?")[0]) : undefined,
    error: null as Error | null,
    isLoading: false,
    mutate: mocks.mutate,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/utils/fetch-wrapper", () => ({
  fetchWithHandling: mocks.fetchWithHandling,
  formatErrorMessage: () => "galat",
  isFetchError: () => false,
}));
vi.mock("react-hot-toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { CommissionRulesPanel } from "@/app/admin/resellers/CommissionRulesPanel";
import { SettlementsPanel } from "@/app/admin/resellers/SettlementsPanel";
import { ResellerReportPanel } from "@/app/admin/resellers/ResellerReportPanel";
import {
  buildReportUrl,
  buildRulePayload,
  currentPeriod,
  describeRulePeriod,
  describeAdjustmentBalance,
  describeRuleValue,
  nextSettlementAction,
  type CommissionRule,
  type Settlement,
} from "@/app/admin/resellers/commission-ui";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const BASE = "/api/admin/resellers/r1";

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.responses.clear();
  mocks.fetchWithHandling.mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Tombol "${text}" tidak ada`);
  return button as HTMLButtonElement;
}

function setValue(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

const RULE: CommissionRule = {
  id: "rule-1",
  hargaPaketId: null,
  hargaPaketName: null,
  type: "PERCENTAGE",
  rate: 10,
  fixedAmount: null,
  status: "ACTIVE",
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: null,
};

describe("helper komisi UI", () => {
  it("membangun payload aturan persen bertanggal kalender WIB (awal & akhir hari)", () => {
    expect(
      buildRulePayload({
        type: "PERCENTAGE",
        value: "12",
        hargaPaketId: "",
        startsAt: "2026-11-01",
        endsAt: "2026-12-31",
      }),
    ).toEqual({
      type: "PERCENTAGE",
      rate: 12,
      hargaPaketId: null,
      startsAt: "2026-11-01T00:00:00+07:00",
      endsAt: "2026-12-31T23:59:59.999+07:00",
    });
  });

  it("menampilkan rentang aturan sebagai tanggal kalender WIB", () => {
    const period = describeRulePeriod({
      startsAt: "2026-11-01T00:00:00+07:00",
      endsAt: "2026-12-31T23:59:59.999+07:00",
    } as CommissionRule);

    expect(period).toMatch(/^1 Nov 2026 – 31 Des 2026$/);
  });

  it.each([
    ["2,5", 2.5],
    ["2.5", 2.5],
    [" 0,25 ", 0.25],
    ["12,75", 12.75],
    ["100", 100],
  ])("menerima persen desimal %j dengan koma atau titik", (value, rate) => {
    expect(
      buildRulePayload({
        type: "PERCENTAGE",
        value,
        hargaPaketId: "",
        startsAt: "",
        endsAt: "",
      }),
    ).toMatchObject({ type: "PERCENTAGE", rate });
  });

  it.each(["0", "0,00", "2,555", "1.000,5", "2,", ",5", "-1", "abc", ""])(
    "menolak persen tidak sah %j",
    (value) => {
      expect(
        buildRulePayload({
          type: "PERCENTAGE",
          value,
          hargaPaketId: "",
          startsAt: "",
          endsAt: "",
        }),
      ).toBeNull();
    },
  );

  it("menolak nominal bukan rupiah bulat positif", () => {
    const form = {
      type: "FIXED" as const,
      value: "2.5",
      hargaPaketId: "",
      startsAt: "",
      endsAt: "",
    };
    expect(buildRulePayload(form)).toBeNull();
    expect(buildRulePayload({ ...form, value: "0" })).toBeNull();
    expect(buildRulePayload({ ...form, value: "2,5" })).toBeNull();
  });

  it("menjelaskan nilai aturan", () => {
    expect(describeRuleValue(RULE)).toBe("10% dari DPP");
    expect(describeRuleValue({ ...RULE, rate: 2.5 })).toBe("2,5% dari DPP");
    expect(describeRuleValue({ ...RULE, rate: 0.75 })).toBe("0,75% dari DPP");
    expect(
      describeRuleValue({
        ...RULE,
        type: "FIXED",
        rate: null,
        fixedAmount: 5000,
      }),
    ).toMatch(/5\.000 \/ invoice$/);
  });

  it("aksi settlement berikutnya mengikuti status", () => {
    expect(nextSettlementAction("PENDING")).toBe("approve");
    expect(nextSettlementAction("APPROVED")).toBe("pay");
    expect(nextSettlementAction("PAID")).toBeNull();
  });

  it("URL laporan dan periode berjalan", () => {
    expect(buildReportUrl("r1", "2026-10", "csv")).toBe(
      `${BASE}/report?period=2026-10&format=csv`,
    );
    expect(currentPeriod(new Date("2026-11-03T10:00:00.000Z"))).toBe("2026-11");
  });
});

describe("CommissionRulesPanel", () => {
  it("menampilkan aturan dan menonaktifkannya", async () => {
    mocks.responses.set(`${BASE}/commission-rules`, [RULE]);
    render(<CommissionRulesPanel resellerId="r1" canManage />);

    expect(container.textContent).toContain("10% dari DPP · Semua paket");
    await act(async () => buttonByText("Nonaktifkan").click());

    expect(mocks.fetchWithHandling).toHaveBeenCalledWith(
      `${BASE}/commission-rules/rule-1`,
      { method: "DELETE" },
    );
    expect(mocks.mutate).toHaveBeenCalled();
  });

  it("mengirim aturan baru dari form", async () => {
    mocks.responses.set(`${BASE}/commission-rules`, []);
    mocks.responses.set("/api/hargapakets", [{ id: "p1", name: "Paket 20M" }]);
    render(<CommissionRulesPanel resellerId="r1" canManage />);

    const valueInput = container.querySelector<HTMLInputElement>(
      'input[inputmode="decimal"]',
    );
    if (!valueInput) throw new Error("Input persen tidak ada");
    const packageSelect = container.querySelectorAll("select")[1];
    act(() => setValue(valueInput, "2,5"));
    act(() => setValue(packageSelect, "p1"));
    await act(async () => buttonByText("Tambah aturan").click());

    const [url, init] = mocks.fetchWithHandling.mock.calls[0];
    expect(url).toBe(`${BASE}/commission-rules`);
    expect(JSON.parse(init.body)).toEqual({
      type: "PERCENTAGE",
      rate: 2.5,
      hargaPaketId: "p1",
      endsAt: null,
    });
  });

  it("menolak persen lebih dari 2 desimal tanpa mengirim", async () => {
    mocks.responses.set(`${BASE}/commission-rules`, []);
    render(<CommissionRulesPanel resellerId="r1" canManage />);

    const valueInput = container.querySelector<HTMLInputElement>(
      'input[inputmode="decimal"]',
    );
    if (!valueInput) throw new Error("Input persen tidak ada");
    act(() => setValue(valueInput, "2,555"));
    await act(async () => buttonByText("Tambah aturan").click());

    expect(valueInput.validity.patternMismatch).toBe(true);
    expect(mocks.fetchWithHandling).not.toHaveBeenCalled();
  });

  it("tanpa izin keuangan hanya menampilkan aturan", () => {
    mocks.responses.set(`${BASE}/commission-rules`, [RULE]);
    render(<CommissionRulesPanel resellerId="r1" canManage={false} />);

    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toContain("Nonaktifkan");
  });
});

const SETTLEMENT: Settlement = {
  id: "s1",
  periodStart: "2026-10-01T00:00:00.000Z",
  periodEnd: "2026-10-31T23:59:59.999Z",
  totalAmount: 50000,
  grossAmount: 50000,
  adjustmentAmount: 0,
  commissionCount: 2,
  status: "PENDING",
  approvedAt: null,
  paidAt: null,
  createdById: null,
  approvedById: null,
  paidById: null,
  paymentMethod: null,
  paymentReference: null,
};

describe("SettlementsPanel", () => {
  it("menyetujui settlement PENDING", async () => {
    mocks.responses.set(`${BASE}/settlements`, [SETTLEMENT]);
    const onChanged = vi.fn();
    render(
      <SettlementsPanel resellerId="r1" canManage onChanged={onChanged} />,
    );

    await act(async () => buttonByText("Setujui").click());

    expect(mocks.fetchWithHandling).toHaveBeenCalledWith(
      `${BASE}/settlements/s1/approve`,
      { method: "POST" },
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("mencatat pembayaran settlement APPROVED dari rekening terpilih", async () => {
    mocks.responses.set(`${BASE}/settlements`, [
      { ...SETTLEMENT, status: "APPROVED" },
    ]);
    // Rekening dari endpoint reseller (izin keuangan reseller), bukan
    // /api/finance/accounts yang butuh izin baca kas tersendiri.
    mocks.responses.set(`${BASE}/payment-accounts`, [
      { id: "acc-1", name: "BCA Operasional", type: "BANK", balance: 750000 },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    act(() => buttonByText("Catat pembayaran").click());
    const form = container.querySelector(
      'form[aria-label="Catat pembayaran settlement"]',
    ) as HTMLFormElement;
    const [, accountSelect] = form.querySelectorAll("select");
    expect(accountSelect.textContent).toContain("BCA Operasional");
    expect(accountSelect.textContent).toMatch(/saldo Rp\s?750\.000/);
    act(() => setValue(accountSelect, "acc-1"));
    await act(async () => buttonByText("Simpan pembayaran").click());

    const [url, init] = mocks.fetchWithHandling.mock.calls[0];
    expect(url).toBe(`${BASE}/settlements/s1/pay`);
    expect(JSON.parse(init.body)).toMatchObject({
      paymentMethod: "BANK_TRANSFER",
      accountId: "acc-1",
      paymentReference: null,
    });
  });

  it("menampilkan koreksi yang dipotong dari settlement", () => {
    mocks.responses.set(`${BASE}/settlements`, [
      {
        ...SETTLEMENT,
        totalAmount: 35000,
        grossAmount: 50000,
        adjustmentAmount: 15000,
      },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    expect(container.textContent).toMatch(/Rp\s?35\.000/);
    expect(container.textContent).toMatch(/Komisi Rp\s?50\.000/);
    expect(container.textContent).toMatch(/Koreksi\s*−Rp\s?15\.000/);
  });

  it("tanpa koreksi tidak menampilkan baris koreksi", () => {
    mocks.responses.set(`${BASE}/settlements`, [SETTLEMENT]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    expect(container.textContent).not.toContain("Koreksi");
  });

  it("mendaftar koreksi komisi beserta sisanya", () => {
    mocks.responses.set(`${BASE}/settlements`, [SETTLEMENT]);
    mocks.responses.set(`${BASE}/commission-adjustments`, [
      {
        id: "adj-1",
        invoiceId: "INV-9",
        amount: 20000,
        remainingAmount: 5000,
        reason: "Invoice di-void setelah komisi dibayar",
        createdAt: "2026-11-02T00:00:00.000Z",
      },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    const list = container.querySelector(
      'section[aria-labelledby="commission-adjustments-title"]',
    );
    expect(list?.textContent).toContain("Koreksi komisi");
    expect(list?.textContent).toContain("INV-9");
    expect(list?.textContent).toContain(
      "Invoice di-void setelah komisi dibayar",
    );
    expect(list?.textContent).toMatch(/Sisa Rp\s?5\.000/);
  });

  it("settlement yang sudah dibayar tidak punya aksi", () => {
    mocks.responses.set(`${BASE}/settlements`, [
      {
        ...SETTLEMENT,
        status: "PAID",
        paidAt: "2026-11-03T00:00:00.000Z",
        paymentMethod: "CASH",
      },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    expect(container.textContent).toContain("Dibayar");
    expect(container.textContent).toContain("Tunai");
    expect(container.textContent).not.toContain("Setujui");
  });

  it("memberi badge peringatan bila penyetuju juga pembayar", () => {
    mocks.responses.set(`${BASE}/settlements`, [
      {
        ...SETTLEMENT,
        status: "PAID",
        paidAt: "2026-11-03T00:00:00.000Z",
        approvedById: "user-1",
        paidById: "user-1",
      },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    expect(container.textContent).toContain(
      "Disetujui & dibayar pengguna yang sama",
    );
  });

  it("tanpa badge bila penyetuju dan pembayar berbeda atau belum dibayar", () => {
    mocks.responses.set(`${BASE}/settlements`, [
      {
        ...SETTLEMENT,
        status: "PAID",
        paidAt: "2026-11-03T00:00:00.000Z",
        approvedById: "user-1",
        paidById: "user-2",
      },
      { ...SETTLEMENT, id: "s2", status: "APPROVED", approvedById: "user-1" },
    ]);
    render(<SettlementsPanel resellerId="r1" canManage />);

    expect(container.textContent).not.toContain("pengguna yang sama");
  });
});

describe("ResellerReportPanel", () => {
  it("menampilkan baris outlet, total, dan tautan CSV", () => {
    const period = currentPeriod();
    mocks.responses.set(`${BASE}/report`, {
      period,
      rows: [
        {
          outletId: "o1",
          outletCode: "A",
          outletName: "Outlet A",
          activeCustomers: 3,
          grossBilled: 333000,
          paid: 222000,
          commissionAccrued: 20000,
          commissionSettled: 10000,
          commissionPaid: 0,
          commissionAdjusted: 3000,
        },
      ],
      totals: {
        activeCustomers: 3,
        grossBilled: 333000,
        paid: 222000,
        commissionAccrued: 20000,
        commissionSettled: 10000,
        commissionPaid: 0,
        commissionAdjusted: 3000,
      },
    });
    render(<ResellerReportPanel resellerId="r1" />);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Outlet A");
    expect(rows[1].textContent).toContain("Total");
    const headers = [...container.querySelectorAll("thead th")].map(
      (header) => header.textContent,
    );
    expect(headers).toContain("Koreksi");
    expect(rows[1].textContent).toMatch(/Rp\s?3\.000/);
    const link = container.querySelector("a[download]") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      `${BASE}/report?period=${period}&format=csv`,
    );
  });
});

describe("describeAdjustmentBalance", () => {
  it("menyebut sisa yang akan dipotong", () => {
    expect(describeAdjustmentBalance({ remainingAmount: 7500 })).toMatch(
      /^Sisa Rp\s?7\.500 dipotong dari settlement berikutnya$/,
    );
  });

  it("menandai koreksi yang sudah habis dipotong", () => {
    expect(describeAdjustmentBalance({ remainingAmount: 0 })).toBe(
      "Sudah dipotong dari settlement",
    );
  });
});
