/**
 * Domain-level errors untuk marketing module.
 *
 * Why: route mapper sebelumnya melakukan substring match pada error.message
 * untuk menentukan HTTP status — rapuh, satu typo di service mengubah 400
 * jadi 500 di produksi. Dengan tagged error class, mapper bisa switch ke
 * `error.kind` yang stable.
 */

export type MarketingErrorKind =
  | "not_found"
  | "invalid_status"
  | "forbidden"
  | "validation";

export class MarketingError extends Error {
  readonly kind: MarketingErrorKind;

  constructor(kind: MarketingErrorKind, message: string) {
    super(message);
    this.name = "MarketingError";
    this.kind = kind;
  }
}

export function isMarketingError(error: unknown): error is MarketingError {
  return error instanceof MarketingError;
}
