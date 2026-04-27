import type { PemasukanEntity } from "../entities/PemasukanEntity";

export interface PemasukanCreateData {
  tanggal: Date | string;
  nomorBukti?: string;
  kategori: string;
  deskripsi: string;
  jumlah: number | string | bigint;
  metodeBayar?: string;
  catatan?: string;
  createdBy?: string;
}

export interface PemasukanUpdateData {
  tanggal?: Date | string;
  nomorBukti?: string;
  kategori?: string;
  deskripsi?: string;
  jumlah?: number | string | bigint;
  metodeBayar?: string | null;
  catatan?: string | null;
  updatedBy?: string | null;
}

/** Repository port for finance pemasukan persistence. */
export interface IPemasukanRepository {
  findAll(): Promise<PemasukanEntity[]>;
  findById(id: string): Promise<PemasukanEntity | null>;
  create(data: PemasukanCreateData): Promise<{ id: string }>;
  update(id: string, data: PemasukanUpdateData): Promise<void>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  findByDateRange(startDate: Date, endDate: Date): Promise<PemasukanEntity[]>;
  findByKategori(kategori: string): Promise<PemasukanEntity[]>;
  aggregateTotal(): Promise<bigint>;
  aggregateTotalByPeriod(month: number, year: number): Promise<bigint>;
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
  ): Promise<PemasukanEntity[]>;
}
