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
 * mentah juga tidak disaring ekstensi isolasi tenant.
 */

/** Pemilik yang baru mendaftarkan token; barisnya sendiri tidak disentuh. */
export interface FcmTokenClaimant {
  kind: "user" | "pelanggan" | "investor" | "mitra";
  id: string;
}

/** Klien atau transaksi Prisma, utama maupun mitra, yang bisa menjalankan SQL mentah. */
interface RawSqlExecutor {
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): PromiseLike<number>;
}

/** Id yang tidak dipakai baris mana pun: tabel itu tidak punya baris yang dikecualikan. */
const NO_EXCLUDED_ID = "";

function excludedId(
  claimant: FcmTokenClaimant,
  kind: FcmTokenClaimant["kind"],
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
  await db.$executeRaw`
    UPDATE "User"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "user")}`;
  await db.$executeRaw`
    UPDATE "Pelanggan"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "pelanggan")}`;
  await db.$executeRaw`
    UPDATE "Investor"
    SET "fcmTokens" = array_remove("fcmTokens", ${token})
    WHERE ${token} = ANY("fcmTokens")
      AND "id" <> ${excludedId(claimant, "investor")}`;
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
  await db.$executeRaw`
    UPDATE "Mitra"
    SET "fcmTokens" = array_remove("fcmTokens", ${token}),
        "pushToken" = NULLIF("pushToken", ${token}),
        "pushTokenUpdatedAt" = CASE WHEN "pushToken" = ${token} THEN NULL ELSE "pushTokenUpdatedAt" END
    WHERE (${token} = ANY("fcmTokens") OR "pushToken" = ${token})
      AND "id" <> ${excludedId(claimant, "mitra")}`;
}
