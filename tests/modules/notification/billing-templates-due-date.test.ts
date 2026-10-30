import { describe, expect, it } from "vitest";
import { BILLING_TEMPLATES } from "@/modules/notification/templates/billing-templates";

// Callers pass the due date as an ISO timestamp; customers used to read
// "Jatuh tempo 2026-10-28T01:02:01.521Z" in the app, WhatsApp and email.
const params = {
  customerName: "Budi",
  invoiceNumber: "INV/2026/10/28-771907EB0151",
  amountDue: 11100,
  dueDate: "2026-10-28T01:02:01.521Z",
};

describe("billing templates due date", () => {
  it.each([
    ["in-app", BILLING_TEMPLATES.invoiceCreated.inApp(params)],
    ["WhatsApp", BILLING_TEMPLATES.invoiceCreated.whatsapp(params)],
    ["email", BILLING_TEMPLATES.invoiceCreated.email(params).body],
    [
      "reminder",
      BILLING_TEMPLATES.invoiceReminder.inApp({
        ...params,
        reminderType: "UPCOMING",
      }),
    ],
  ])("shows a readable date in the %s message", (_channel, text) => {
    expect(text).toContain("28 Okt 2026");
    expect(text).not.toContain("T01:02");
  });

  // 23:30 WIB is still the 28th in Jakarta although it is the 28th 16:30 UTC.
  it("reads the date in Jakarta time", () => {
    const text = BILLING_TEMPLATES.invoiceCreated.inApp({
      ...params,
      dueDate: "2026-10-27T17:30:00.000Z",
    });

    expect(text).toContain("28 Okt 2026");
  });

  it("keeps a date that is already written out", () => {
    const text = BILLING_TEMPLATES.invoiceCreated.inApp({
      ...params,
      dueDate: "28 Oktober 2026",
    });

    expect(text).toContain("Jatuh tempo 28 Oktober 2026");
  });
});
