/**
 * Constants untuk pagination MikroTik router list
 */
export const MIKROTIK_PAGINATION = {
  DEFAULT_LIMIT: 10,
  LIMIT_OPTIONS: [10, 25, 50, 100] as const,
  DEFAULT_PAGE: 1,
} as const;

/**
 * Constants untuk debounce timing
 */
export const MIKROTIK_DEBOUNCE = {
  SEARCH_DELAY_MS: 500,
} as const;

/**
 * Constants untuk API endpoints
 */
export const MIKROTIK_API = {
  BASE: "/api/mikrotik-routers",
  TEST_CONNECTION: "/api/mikrotik-routers/test-connection",
  SETTINGS_GENERAL: "/api/settings/general",
} as const;
