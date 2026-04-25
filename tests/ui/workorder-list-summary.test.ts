import { describe, expect, it } from "vitest";

import {
  buildTopCustomerSearchValue,
  buildVisibleTopCustomers,
  buildWorkOrderSummaryCards,
} from "@/app/admin/workorders/list/summary";
import { buildWorkOrderListSummary } from "@/modules/work-order/utils/work-order-list-summary";

describe("workorder list summary cards", () => {
  it("counts completed, unfinished, focut, and dismantle work orders", () => {
    const cards = buildWorkOrderSummaryCards([
      {
        status: "COMPLETED",
        type: "TROUBLESHOOT",
        title: "Internet Mati / FOCUT",
        startedAt: "2026-04-25T01:00:00.000Z",
        completedAt: "2026-04-25T03:00:00.000Z",
      },
      {
        status: "VERIFIED",
        type: "OTHER",
        title: "Pekerjaan sudah diverifikasi",
        startedAt: "2026-04-25T02:00:00.000Z",
        completedAt: "2026-04-25T08:00:00.000Z",
      },
      {
        status: "PENDING",
        type: "DISCONNECTION",
        title: "Penarikan perangkat pelanggan",
      },
      { status: "IN_PROGRESS", type: "MAINTENANCE", title: "LOS merah di ODP" },
      {
        status: "CANCELLED",
        type: "DISCONNECTION",
        title: "Dismantle dibatalkan",
      },
    ]);

    expect(cards.map((card) => [card.id, card.value])).toEqual([
      ["completed", 2],
      ["unfinished", 2],
      ["focut", 2],
      ["dismantle", 2],
      ["averageCompletionTime", "4 jam"],
    ]);
  });

  it("builds a search value from a top customer name", () => {
    expect(buildTopCustomerSearchValue("  PT Sinar Net  ")).toBe(
      "PT Sinar Net",
    );
  });

  it("keeps the previous top customers while filtering by clicked customer", () => {
    const previousCustomers = [
      { name: "Budi Santoso", phone: "0822222222", count: 3 },
      { name: "PT Sinar Net", phone: "0811111111", count: 2 },
    ];
    const filteredCustomers = [
      { name: "Budi Santoso", phone: "0822222222", count: 3 },
    ];

    expect(buildVisibleTopCustomers(filteredCustomers, previousCustomers)).toBe(
      previousCustomers,
    );
  });

  it("lists customers with the most work orders and phone numbers", () => {
    const summary = buildWorkOrderListSummary([
      createWorkOrderForCustomer("PT Sinar Net", "0811111111", "Site Pusat"),
      createWorkOrderForCustomer("PT Sinar Net", "0811111111", "Site Pusat"),
      createWorkOrderForCustomer("Budi Santoso", "0822222222", "Site Barat"),
      createWorkOrderForCustomer("Budi Santoso", "0822222222", "Site Barat"),
      createWorkOrderForCustomer("Budi Santoso", "0822222222", "Site Barat"),
      createWorkOrderForCustomer("CV Lintas Fiber", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Technical", null),
      createWorkOrderForContact("Nani sumarni", "0833333333", "Site Timur"),
      createWorkOrderForContact("Nani sumarni", "0833333333", "Site Timur"),
      createWorkOrderForContact("Nani sumarni", "0833333333", "Site Timur"),
      createWorkOrderForContact("Nani sumarni", "0833333333", "Site Timur"),
      { status: "PENDING", type: "OTHER", title: "Internal request" },
    ]);

    expect(summary.topCustomers).toEqual([
      {
        name: "Nani sumarni",
        phone: "0833333333",
        count: 4,
        siteName: "Site Timur",
      },
      {
        name: "Budi Santoso",
        phone: "0822222222",
        count: 3,
        siteName: "Site Barat",
      },
      {
        name: "PT Sinar Net",
        phone: "0811111111",
        count: 2,
        siteName: "Site Pusat",
      },
    ]);
  });
});

function createWorkOrderForCustomer(
  name: string,
  phone: string | null,
  siteName?: string,
) {
  return {
    status: "PENDING",
    type: "OTHER",
    title: `WO ${name}`,
    pelanggan: { nama: name, noTelp: phone },
    site: siteName ? { name: siteName } : null,
  };
}

function createWorkOrderForContact(
  name: string,
  phone: string | null,
  siteName?: string,
) {
  return {
    status: "PENDING",
    type: "OTHER",
    title: `WO ${name}`,
    contactName: name,
    contactPhone: phone,
    site: siteName ? { name: siteName } : null,
  };
}
