export class AccountingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AccountingError";
  }
}

export class JournalUnbalancedError extends AccountingError {
  constructor(debit: string, credit: string) {
    super(
      `Journal tidak balance: DR=${debit}, CR=${credit}`,
      "JOURNAL_UNBALANCED",
    );
  }
}

export class PeriodClosedError extends AccountingError {
  constructor(year: number, month: number) {
    super(
      `Periode ${year}-${String(month).padStart(2, "0")} sudah ditutup`,
      "PERIOD_CLOSED",
    );
  }
}

export class CoaNotFoundError extends AccountingError {
  constructor(identifier: string) {
    super(`Akun COA tidak ditemukan: ${identifier}`, "COA_NOT_FOUND");
  }
}

export class CoaNotPostableError extends AccountingError {
  constructor(code: string) {
    super(
      `Akun ${code} adalah header account, tidak bisa di-post`,
      "COA_NOT_POSTABLE",
    );
  }
}

export class JournalAlreadyReversedError extends AccountingError {
  constructor(entryNumber: string) {
    super(
      `Journal ${entryNumber} sudah di-reverse`,
      "JOURNAL_ALREADY_REVERSED",
    );
  }
}

export class DuplicateJournalSourceError extends AccountingError {
  constructor(source: string, sourceRefId: string) {
    super(
      `Journal untuk source=${source}, ref=${sourceRefId} sudah ada`,
      "DUPLICATE_JOURNAL_SOURCE",
    );
  }
}
