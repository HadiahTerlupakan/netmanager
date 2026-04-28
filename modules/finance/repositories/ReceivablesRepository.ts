import { prismaBilling } from "@/modules/database";
import type { IReceivablesRepository } from "../domain/ports/IReceivablesRepository";

export class ReceivablesRepository implements IReceivablesRepository {
  /** Ambil daftar piutang untuk halaman receivables. */
  findReceivables() {
    return prismaBilling.invoice.findMany({
      orderBy: { dueDate: "desc" },
      include: { payment: true },
    });
  }
}
