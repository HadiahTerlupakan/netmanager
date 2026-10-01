import type {
  RencanaEntity,
  RencanaJenis,
  RencanaStatus,
  RencanaStatusTampil,
  RencanaSumber,
} from "../domain/entities/Rencana";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import {
  isLaporanTerlambat,
  tentukanStatusTampil,
  type BarisRekapRencana,
} from "../domain/rencana-rules";
import type { KonteksWaktuRencana } from "../services/RencanaService";
import { toKegiatanDetail, type KegiatanDetailDto } from "./kegiatan.dto";

/**
 * Bentuk rencana kunjungan yang dikirim ke klien (web & mobile).
 */

export interface RencanaDto {
  id: string;
  salesId: string;
  namaSales: string | null;
  dibuatOlehId: string;
  namaPembuat: string | null;
  sumber: RencanaSumber;
  jenis: RencanaJenis;
  tanggal: string;
  jam: string | null;
  tujuan: string;
  prospekId: string | null;
  namaProspek: string | null;
  alamat: string | null;
  latitude: number | null;
  longitude: number | null;
  status: RencanaStatus;
  /** Status untuk ditampilkan: TERLEWAT = DIRENCANAKAN yang tanggalnya lewat. */
  statusTampil: RencanaStatusTampil;
  isTerlambat: boolean;
  kegiatanId: string | null;
  dilaporkanAt: string | null;
  alasanBatal: string | null;
  dibatalkanAt: string | null;
  createdAt: string;
}

export interface RincianRencanaDto extends RencanaDto {
  /** Laporan kunjungan (kegiatan) bila rencana sudah dilaporkan. */
  laporan: KegiatanDetailDto | null;
}

export type BarisRekapRencanaDto = BarisRekapRencana;

/** Bentuk rencana untuk klien, dengan status tampil menurut hari ini tenant. */
export function toRencanaDto(
  rencana: RencanaEntity,
  waktu: KonteksWaktuRencana,
): RencanaDto {
  return {
    id: rencana.id,
    salesId: rencana.salesId,
    namaSales: rencana.namaSales,
    dibuatOlehId: rencana.dibuatOlehId,
    namaPembuat: rencana.namaPembuat,
    sumber: rencana.sumber,
    jenis: rencana.jenis,
    tanggal: rencana.tanggal,
    jam: rencana.jam,
    tujuan: rencana.tujuan,
    prospekId: rencana.prospekId,
    namaProspek: rencana.namaProspek,
    alamat: rencana.alamat,
    latitude: rencana.latitude,
    longitude: rencana.longitude,
    status: rencana.status,
    statusTampil: tentukanStatusTampil(rencana, waktu.hariIni),
    isTerlambat: isLaporanTerlambat(rencana, waktu.zonaWaktu),
    kegiatanId: rencana.kegiatanId,
    dilaporkanAt: rencana.dilaporkanAt?.toISOString() ?? null,
    alasanBatal: rencana.alasanBatal,
    dibatalkanAt: rencana.dibatalkanAt?.toISOString() ?? null,
    createdAt: rencana.createdAt.toISOString(),
  };
}

/** Rincian rencana beserta laporan kegiatannya. */
export function toRincianRencanaDto(
  rincian: { rencana: RencanaEntity; laporan: KegiatanEntity | null },
  waktu: KonteksWaktuRencana,
): RincianRencanaDto {
  return {
    ...toRencanaDto(rincian.rencana, waktu),
    laporan: rincian.laporan ? toKegiatanDetail(rincian.laporan) : null,
  };
}
