import { compare, hash } from "bcryptjs";
import { Status, TipePelanggan } from "../types/pelanggan.enums";
import { canAccessSite } from "@/modules/roles";
import { isSuperAdmin } from "@/lib/auth";
import type {
  AdminMutationSession,
  UpdatePppByIdInput,
} from "./PelangganAdminMutationService";
import type { UpdatePelangganProfileInput } from "../validators/pelanggan";

export type NormalizedUpdatePayload = {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  hargaPaketId: string;
  resellerId: string | null;
  resellerOutletId: string | null;
  tipe: TipePelanggan | null;
  tanggalAktif: Date;
  jatuhTempo: Date;
  status: Status | null;
  autoIsolir: boolean;
  email: string | null;
  siteId: string | null;
  odpId: string | null;
  /** Field profil/biaya yang diubah; hanya berisi key yang benar-benar dikirim. */
  profile: UpdatePelangganProfileInput;
  invoiceAction: string | null;
  passwordLogin: string | null;
};

export const normalizeText = (value: string | null | undefined) =>
  value?.trim() ?? "";

export const getTenantScopedWhereById = (
  session: AdminMutationSession,
  id: string,
) => {
  const tenantId = session.user.tenantId ?? null;
  const isUserSuperAdmin = isSuperAdmin(session.user);

  if (!tenantId && !isUserSuperAdmin) {
    throw new Error("Akses ditolak: tenant tidak teridentifikasi");
  }

  return tenantId ? { id, tenantId } : { id };
};

export const canAccessPelangganBySite = (
  session: AdminMutationSession,
  siteId: string | null | undefined,
) => {
  if (!session.user.role || isSuperAdmin(session.user)) return true;
  return canAccessSite(
    session as Parameters<typeof canAccessSite>[0],
    "pelanggan",
    siteId,
  );
};

export const sanitizePelangganResponse = <
  T extends { password?: string | null; passwordHash?: string | null },
>(
  pelanggan: T,
): Omit<T, "password" | "passwordHash"> => {
  const {
    password: _password,
    passwordHash: _passwordHash,
    ...safePelanggan
  } = pelanggan;
  return safePelanggan;
};

const parseEnumValue = <T extends string>(
  value: string | null,
  enumObject: Record<string, T>,
): T | null => {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return (
    ((Object.values(enumObject) as string[]).find(
      (enumValue) => enumValue.toUpperCase() === normalized,
    ) as T) ?? null
  );
};

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

/**
 * Password sengaja TIDAK termasuk field wajib saat update.
 *
 * Halaman edit tidak pernah menerima password dari server — `password` selalu
 * di-strip dari response, dan `passwordLogin` bahkan tidak punya kolom di
 * database. Selama password diwajibkan, form yang tampil kosong itu pasti
 * ditolak 400, dan admin yang mengisi asal agar bisa menyimpan justru menimpa
 * password PPPoE asli — perubahan yang ikut tersinkron ke RADIUS/MikroTik.
 * Kosong kini berarti "tidak diubah".
 */
const assertRequiredPppFields = (data: UpdatePppByIdInput["data"]) => {
  if (
    !data.idPelanggan ||
    !data.nama ||
    !data.username ||
    !data.hargaPaketId ||
    !data.tanggalAktif ||
    !data.jatuhTempo
  ) {
    throw new Error("Semua field wajib harus diisi");
  }
};

const assertValidDate = (value: Date | string, errorMessage: string) => {
  const parsedDate = toDate(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(errorMessage);
  }
  return parsedDate;
};

/** Normalize admin PPP update payload before persistence. */
export const normalizeUpdatePayload = (
  data: UpdatePppByIdInput["data"],
): NormalizedUpdatePayload => {
  assertRequiredPppFields(data);

  return {
    idPelanggan: data.idPelanggan,
    nama: data.nama,
    username: data.username,
    password: data.password,
    hargaPaketId: data.hargaPaketId,
    resellerId: data.resellerId?.trim() || null,
    resellerOutletId: data.resellerOutletId?.trim() || null,
    tipe: parseEnumValue(data.tipe, TipePelanggan),
    tanggalAktif: assertValidDate(
      data.tanggalAktif,
      "Tanggal aktif tidak valid",
    ),
    jatuhTempo: assertValidDate(
      data.jatuhTempo,
      "Tanggal jatuh tempo tidak valid",
    ),
    status: parseEnumValue(data.status, Status),
    autoIsolir: data.autoIsolir,
    email: data.email,
    siteId: data.siteId === "" ? null : data.siteId,
    // String kosong berarti "tanpa ODP", bukan id kosong yang akan melanggar
    // foreign key ke `mapping_nodes`.
    odpId: data.odpId?.trim() || null,
    profile: data.profile ?? {},
    invoiceAction: data.invoiceAction,
    passwordLogin: data.passwordLogin,
  };
};

/** Check whether login password actually changes. */
export const hasPasswordLoginChanged = async (
  existingPasswordHash: string | null,
  nextPasswordLogin: string | null,
) => {
  if (!nextPasswordLogin) return false;
  if (!existingPasswordHash) return true;

  try {
    return !(await compare(
      normalizeText(nextPasswordLogin),
      existingPasswordHash,
    ));
  } catch {
    return true;
  }
};

/** Hash normalized login password when present. */
export const hashPasswordLogin = async (passwordLogin: string) => {
  if (!passwordLogin) return null;
  return hash(passwordLogin, 12);
};
