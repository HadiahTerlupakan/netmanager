import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { CreatePelangganDTO, FilterOptions } from "./PelangganRepository";
import { pelangganWithPackageInclude } from "./pelanggan-repository.constants";

/** Build pelanggan filter clause for listing queries. */
export const buildPelangganWhereClause = (
  filter?: FilterOptions,
): Prisma.PelangganWhereInput => {
  const where: Prisma.PelangganWhereInput = {};

  if (filter?.status) {
    where.status = filter.status;
  }

  if (filter?.siteId) {
    where.siteId = filter.siteId;
  }

  if (filter?.search) {
    where.OR = [
      { nama: { contains: filter.search, mode: "insensitive" } },
      { idPelanggan: { contains: filter.search, mode: "insensitive" } },
      { username: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  return where;
};

/** Build pelanggan create payload with defaults. */
export const buildCreatePelangganData = (
  data: CreatePelangganDTO,
): Prisma.PelangganUncheckedCreateInput => ({
  id: randomUUID(),
  updatedAt: new Date(),
  idPelanggan: data.idPelanggan,
  nama: data.nama,
  username: data.username,
  password: data.password,
  passwordHash: data.passwordHash,
  hargaPaketId: data.hargaPaketId,
  resellerId: data.resellerId,
  resellerOutletId: data.resellerOutletId,
  tipe: data.tipe,
  tanggalAktif: data.tanggalAktif,
  jatuhTempo: data.jatuhTempo,
  status: data.status,
  autoIsolir: data.autoIsolir ?? true,
  alamat: data.alamat,
  provinsi: data.provinsi,
  kabupatenKota: data.kabupatenKota,
  kelurahanDesa: data.kelurahanDesa,
  kecamatan: data.kecamatan,
  noTelp: data.noTelp,
  email: data.email,
  latitude: data.latitude,
  longitude: data.longitude,
  jenisDokumen: data.jenisDokumen,
  noDokumen: data.noDokumen,
  fileKTP: data.fileKTP,
  fileRumahSekitar: data.fileRumahSekitar,
  fileBAST: data.fileBAST,
  catatan: data.catatan,
  usePPN: data.usePPN ?? true,
  useDiscount: data.useDiscount ?? false,
  useProrate: data.useProrate ?? false,
  discountType: data.discountType,
  discountValue: data.discountValue,
  discountDuration: data.discountDuration,
  discountDurationUnit: data.discountDurationUnit,
  biayaInstalasi: data.biayaInstalasi,
  biayaInstalasiIsRecurring: data.biayaInstalasiIsRecurring ?? false,
  biayaInstalasiDiskon: data.biayaInstalasiDiskon,
  biayaSewaPerangkat: data.biayaSewaPerangkat,
  biayaSewaPerangkatIsRecurring: data.biayaSewaPerangkatIsRecurring ?? true,
  biayaSewaPerangkatDiskon: data.biayaSewaPerangkatDiskon,
  biayaLainnya: data.biayaLainnya,
  biayaLainnyaIsRecurring: data.biayaLainnyaIsRecurring ?? false,
  biayaLainnyaDiskon: data.biayaLainnyaDiskon,
  keteranganBiayaLainnya: data.keteranganBiayaLainnya,
  odpId: data.odpId,
  siteId: data.siteId,
});

/** Build pelanggan create query args with relation include. */
export const buildCreatePelangganArgs = (data: CreatePelangganDTO) => ({
  data: buildCreatePelangganData(data),
  include: pelangganWithPackageInclude,
});
