import { Money } from "../../domain/value-objects/Money";
import { JournalUnbalancedError } from "../../errors";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";

export function validateBalance(lines: JournalLineDraft[]): void {
  let totalDebit = Money.zero();
  let totalCredit = Money.zero();

  for (const line of lines) {
    const amount = Money.fromString(line.amount);
    if (line.side === "DEBIT") {
      totalDebit = totalDebit.add(amount);
    } else {
      totalCredit = totalCredit.add(amount);
    }
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new JournalUnbalancedError(
      totalDebit.toString(),
      totalCredit.toString(),
    );
  }
}
