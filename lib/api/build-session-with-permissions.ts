import type { Session } from "next-auth";
import type { HandlerContext } from "./handler";

/**
 * Bangun objek session dengan `permissions` di-inject ke `session.user`,
 * bentuk yang dibutuhkan oleh `checkSiteRestriction` (yang membaca
 * `session.user.permissions`).
 *
 * Why: `createHandler` menyimpan permissions terpisah di `ctx.permissions`,
 * BUKAN di `ctx.session.user.permissions`. Helper ini menjembatani gap agar
 * helper site-restriction yang already-existing bisa dipakai tanpa duplikasi
 * logika di setiap route.
 *
 * Return type dipaksa `Session` (NextAuth) karena downstream helper mengharap
 * `expires` field. `checkSiteRestriction` hanya baca `user.*`, jadi field
 * `expires` boleh dummy — kita isi dengan string kosong yang aman.
 */
export function buildSessionWithPermissions(
  session: NonNullable<HandlerContext["session"]>,
  permissions: string[],
): Session {
  return {
    ...session,
    user: {
      ...session.user,
      permissions,
    },
    expires: "",
  } as unknown as Session;
}
