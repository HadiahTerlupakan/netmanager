/** Kolom kredensial API router yang dibutuhkan untuk membuka koneksi. */
export interface RouterCredentialsInput {
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated?: string | null;
  apiPasswordGenerated?: string | null;
}

/**
 * Kredensial koneksi API router: user API buatan billing bila ada, selain itu
 * kredensial manual router. Dipakai bersama oleh Reconfigurasi dan pengiriman
 * halaman isolir supaya keduanya masuk dengan user yang sama.
 */
export function getRouterCredentials(router: RouterCredentialsInput) {
  return {
    username: router.apiUsernameGenerated || router.apiUsername,
    password: router.apiPasswordGenerated || router.apiPassword,
  };
}
