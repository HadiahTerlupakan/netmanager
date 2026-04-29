import snmp from "net-snmp";

/** Shared SNMP timeout for standard requests. */
export const DEFAULT_SNMP_TIMEOUT = 10_000;

/** Extended SNMP timeout for large dataset operations. */
export const LARGE_SNMP_TIMEOUT = 300_000;

/** Polling delay for batch continuation. */
export const BATCH_DELAY_MS = 200;

/** Polling delay for sequential get-next operations. */
export const GET_NEXT_DELAY_MS = 10;

/** Stability check interval for walk operations. */
export const STABILITY_CHECK_INTERVAL_MS = 3_000;

/** Internal marker for installed global error handler. */
export const SNMP_ERROR_HANDLER_FLAG = "__SNMP_ERROR_HANDLER_ADDED";

/** Default SNMP v2c version used by net-snmp. */
export const DEFAULT_SNMP_VERSION: 0 | 1 = snmp.Version2c;

/** SNMP v1 version used by net-snmp. */
export const SNMP_V1_VERSION: 0 | 1 = snmp.Version1;

/** GetBulk max repetitions for standard requests. */
export const DEFAULT_MAX_REPETITIONS = 50;

/** GetBulk max repetitions for large expected result sets. */
export const LARGE_MAX_REPETITIONS = 100;

/** Max rows per subtree request. */
export const SUBTREE_MAX_REPETITIONS = 20;
