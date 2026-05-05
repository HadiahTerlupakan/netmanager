import type { AxiosInstance } from "axios";

import type { FetchCustomersParams } from "./mixradius-types";

export type MixRadiusBaseClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  filters?: FetchCustomersParams;
};

export function buildMixRadiusBaseClientParams(input: {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  filters?: FetchCustomersParams;
}): MixRadiusBaseClientParams {
  return {
    client: input.client,
    baseUrl: input.baseUrl,
    login: input.login,
    onSessionExpired: input.onSessionExpired,
    randomDelay: input.randomDelay,
    filters: input.filters,
  };
}
