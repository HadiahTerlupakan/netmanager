import type { PengeluaranEntity } from "../entities/PengeluaranEntity";

export interface PengeluaranCreateData {
  tanggal: Date | string;
  nomorBukti?: string;
  tipePengeluaran?: "CAPEX" | "OPEX";
  kategori: string;
  deskripsi: string;
  jumlah: number | string | bigint;
  metodeBayar?: string;
  catatan?: string;
  createdBy?: string;
}

export interface PengeluaranUpdateData {
  tanggal?: Date | string;
  nomorBukti?: string;
  tipePengeluaran?: "CAPEX" | "OPEX";
  kategori?: string;
  deskripsi?: string;
  jumlah?: number | string | bigint;
  metodeBayar?: string | null;
  catatan?: string | null;
  updatedBy?: string | null;
}

/** Repository port for finance pengeluaran persistence. */
export interface IPengeluaranRepository {
  findAll(): Promise<PengeluaranEntity[]>;
  findById(id: string): Promise<PengeluaranEntity | null>;
  create(data: PengeluaranCreateData): Promise<{ id: string }>;
  update(id: string, data: PengeluaranUpdateData): Promise<void>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  findByDateRange(startDate: Date, endDate: Date): Promise<PengeluaranEntity[]>;
  findByKategori(kategori: string): Promise<PengeluaranEntity[]>;
  aggregateTotal(): Promise<bigint>;
  aggregateTotalByPeriod(month: number, year: number): Promise<bigint>;
  aggregateTotalByTipe(tipePengeluaran: "CAPEX" | "OPEX"): Promise<bigint>;
  aggregateTotalByTipeAndPeriod(
    tipePengeluaran: "CAPEX" | "OPEX",
    month: number,
    year: number,
  ): Promise<bigint>;
  groupByPeriode(): Promise<Array<{ tanggal: Date; jumlah: bigint }>>;
  findIdsAndDates(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<Array<{ id: string; tanggal: Date }>>;
  findByFilters(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<PengeluaranEntity[]>;
}
