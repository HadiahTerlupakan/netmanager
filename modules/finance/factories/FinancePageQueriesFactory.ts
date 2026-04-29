import type { IUnpaidBillsReadRepository } from "../domain/ports/IUnpaidBillsReadRepository";
import { UnpaidBillsReadRepository } from "../repositories/UnpaidBillsReadRepository";

/** Buat repository unpaid bills untuk wiring service. */
export function createUnpaidBillsReadRepository(): IUnpaidBillsReadRepository {
  return new UnpaidBillsReadRepository();
}
