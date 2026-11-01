import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";

/**
 * Satu token FCM menandai satu pemasangan aplikasi, jadi hanya pemilik yang
 * terakhir mendaftarkannya yang boleh memegangnya. Perangkat sering berpindah
 * tangan tanpa token dilepas: staf yang keluar paksa karena sesinya berakhir,
 * pelanggan A lalu pelanggan B, staf lalu pelanggan. Tanpa pelepasan ini push
 * pemilik lama sampai ke orang yang sekarang memegang perangkat itu.
 *
 * Pelepasan berlaku lintas tenant, karena token milik perangkat, bukan tenant,
 * dan ditulis sebagai SQL mentah: `array_remove` membuang token dalam satu
 * pernyataan tanpa baca-lalu-tulis yang bisa menimpa perubahan lain. SQL
 * mentah juga tidak disaring ekstensi isolasi tenant. Setiap pelepasan dari
 * pemilik lain dicatat, supaya pendaftaran token curian bisa dilacak.
 */

type FcmTokenOwnerKind = "user" | "pelanggan" | "investor" | "mitra";

/** Pemilik yang baru mendaftarkan token; barisnya sendiri tidak disentuh. */
export interface FcmTokenClaimant {
  kind: FcmTokenOwnerKind;
  id: string;
  tenantId: string | null;
}

/** Baris pemilik lain yang baru kehilangan token. */
interface ReleasedOwnerRow {
  id: string;
  tenantId: string | null;
}

/** Klien atau transaksi Prisma, utama maupun mitra, yang bisa menjalankan SQL mentah. */
interface RawSqlExecutor {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): PromiseLike<T>;
}

/** Id yang tidak dipakai baris mana pun: tabel itu tidak punya baris yang dikecualikan. */
const NO_EXCLUDED_ID = "";

/** Panjang sidik token di log: cukup untuk mencocokkan kejadian, bukan token itu sendiri. */
const FCM_TOKEN_REF_LENGTH = 12;

const AUDIT_MESSAGE = "[FCM] Token dilepas dari pemilik lain";

function excludedId(
  claimant: FcmTokenClaimant,
  kind: FcmTokenOwnerKind,
): string {
  return claimant.kind === kind ? claimant.id : NO_EXCLUDED_ID;
}

/**
 * Lepas token dari setiap pemilik lain di database utama (User, Pelanggan,
 * Investor) dan kosongkan `pushToken` lama yang sama. Bila pemilik baru ada di
 * database utama, jalankan di transaksi pendaftarannya supaya keduanya terjadi
 * bersama; selain itu sebagai langkah sesudahnya. Aman diulang.
 */
export async function releaseFcmTokenInMainDb(
  db: RawSqlExecutor,
  token: string,
  claimant: FcmTokenClaimant,
): Promise<void> {
  const users = await db.$queryRaw<ReleasedOwnerRow[]>`
    UPDATE "User"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "user")}
    RETURNING "id", "tenantId"`;
  auditRelease(token, claimant, "user", users);

  const pelanggan = await db.$queryRaw<ReleasedOwnerRow[]>`
    UPDATE "Pelanggan"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "pelanggan")}
    RETURNING "id", "tenantId"`;
  auditRelease(token, claimant, "pelanggan", pelanggan);

  const investors = await db.$queryRaw<ReleasedOwnerRow[]>`
    UPDATE "Investor"
    SET "fcmTokens" = array_remove("fcmTokens", ${token})
    WHERE ${token} = ANY("fcmTokens")
      AND "id" <> ${excludedId(claimant, "investor")}
    RETURNING "id", "tenantId"`;
  auditRelease(token, claimant, "investor", investors);
}

/**
 * Lepas token dari setiap mitra lain di database mitra dan kosongkan
 * `pushToken` lama yang sama. Bila pemilik baru seorang mitra, jalankan di
 * transaksi pendaftarannya; selain itu sebagai langkah sesudahnya. Aman diulang.
 */
export async function releaseFcmTokenInMitraDb(
  db: RawSqlExecutor,
  token: string,
  claimant: FcmTokenClaimant,
): Promise<void> {
  const mitras = await db.$queryRaw<ReleasedOwnerRow[]>`
    UPDATE "Mitra"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "mitra")}
    RETURNING "id", "tenantId"`;
  auditRelease(token, claimant, "mitra", mitras);
}

/**
 * Jejak audit untuk setiap pemilik lain yang kehilangan token. Token hanya
 * disebut lewat sidik pendeknya; pelepasan yang melintasi tenant atau peran
 * ditandai di pesannya supaya mudah dicari.
 */
function auditRelease(
  token: string,
  claimant: FcmTokenClaimant,
  kind: FcmTokenOwnerKind,
  releasedOwners: ReleasedOwnerRow[],
): void {
  for (const previousOwner of releasedOwners) {
    const crossesTenant = previousOwner.tenantId !== claimant.tenantId;
    const crossesRole = kind !== claimant.kind;
    logger.warn(buildAuditMessage(crossesTenant, crossesRole), {
      tokenRef: fcmTokenRef(token),
      claimant: {
        kind: claimant.kind,
        id: claimant.id,
        tenantId: claimant.tenantId,
      },
      previousOwner: {
        kind,
        id: previousOwner.id,
        tenantId: previousOwner.tenantId,
      },
      crossesTenant,
      crossesRole,
    });
  }
}

function buildAuditMessage(crossesTenant: boolean, crossesRole: boolean) {
  const flags = [
    crossesTenant ? "lintas tenant" : null,
    crossesRole ? "lintas peran" : null,
  ].filter(Boolean);
  return flags.length > 0
    ? `${AUDIT_MESSAGE} (${flags.join(", ")})`
    : AUDIT_MESSAGE;
}

function fcmTokenRef(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex")
    .slice(0, FCM_TOKEN_REF_LENGTH);
}
