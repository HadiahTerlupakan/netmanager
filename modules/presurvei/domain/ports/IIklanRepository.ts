import type { IklanChannel, IklanEntity } from "../entities/Iklan";

/**
 * Kontrak akses data iklan presurvei.
 */

export interface IklanListFilters {
  channel?: IklanChannel;
  isAktif?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateIklanInput {
  nama: string;
  kode: string;
  channel: IklanChannel;
  tanggalMulai: Date;
  tanggalSelesai?: Date | null;
  biaya?: number | null;
  penanggungJawabId?: string | null;
  isAktif?: boolean;
}

export interface UpdateIklanInput {
  nama?: string;
  channel?: IklanChannel;
  tanggalMulai?: Date;
  tanggalSelesai?: Date | null;
  biaya?: number | null;
  penanggungJawabId?: string | null;
  isAktif?: boolean;
}

export interface IIklanRepository {
  findMany(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }>;
  findById(id: string): Promise<IklanEntity | null>;
  /** Iklan dengan kode kampanye tertentu — dipakai mencocokkan `utm_campaign`. */
  findByKode(kode: string): Promise<IklanEntity | null>;
  create(input: CreateIklanInput): Promise<IklanEntity>;
  update(id: string, input: UpdateIklanInput): Promise<IklanEntity>;
}
