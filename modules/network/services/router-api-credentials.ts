/** Kolom kredensial API router yang tersimpan. */
export interface StoredRouterApiCredentials {
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
}

/** Kredensial API yang dipakai netmanager: user generated bila ada, selain itu user awal. */
export function routerApiCredentials(router: StoredRouterApiCredentials): {
  username: string;
  password: string;
} {
  return {
    username: router.apiUsernameGenerated || router.apiUsername,
    password: router.apiPasswordGenerated || router.apiPassword,
  };
}
