import type { ReceivableEntity } from "../entities/ReceivableEntity";

export interface IReceivablesRepository {
  /** Ambil daftar piutang untuk halaman receivables. */
  findReceivables(): Promise<ReceivableEntity[]>;
}
