import { DEFAULT_SNMP_VERSION, SNMP_V1_VERSION } from "./constants";

/** Resolve application SNMP version string to net-snmp version constant. */
export function resolveSnmpVersion(version: string): 0 | 1 {
  if (version === "1") {
    return SNMP_V1_VERSION;
  }

  return DEFAULT_SNMP_VERSION;
}
