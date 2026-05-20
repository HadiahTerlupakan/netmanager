import { describe, expect, it } from "vitest";
import { validateBalance } from "@/modules/accounting/services/journal/balanceValidator";
import { JournalUnbalancedError } from "@/modules/accounting/errors";
import type { JournalLineDraft } from "@/modules/accounting/domain/entities/JournalLine";

describe("balanceValidator", () => {
  it("passes when DR equals CR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "100000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "100000.00" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });

  it("passes with multiple lines that balance", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-2", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-3", side: "CREDIT", amount: "75000.00" },
      { coaId: "coa-4", side: "CREDIT", amount: "25000.00" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });

  it("throws JournalUnbalancedError when DR > CR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "100000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "99999.99" },
    ];
    expect(() => validateBalance(lines)).toThrow(JournalUnbalancedError);
  });

  it("throws JournalUnbalancedError when CR > DR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "75000.00" },
    ];
    expect(() => validateBalance(lines)).toThrow(JournalUnbalancedError);
  });

  it("handles decimal precision without float drift", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "0.10" },
      { coaId: "coa-2", side: "DEBIT", amount: "0.20" },
      { coaId: "coa-3", side: "CREDIT", amount: "0.30" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });
});
