import type { RouterConfig } from "./MikroTikConnectionFactory";

/**
 * PPP Secret data structure untuk create/update operations
 */
export interface PPPSecretData {
  name: string;
  password: string;
  profile: string;
  service?: string;
  comment?: string;
  disabled?: boolean;
}

/**
 * Router context untuk pelanggan PPP
 * Berisi informasi router config, credentials, dan profile
 */
export interface PelangganRouterContext {
  router: RouterConfig;
  routerId: string;
  pelanggan: {
    username: string;
    password: string;
    nama: string;
  };
  profileName: string;
}
