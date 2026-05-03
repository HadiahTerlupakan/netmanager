import {
  MAX_CHUNK_SIZE,
  SNMP_TIMEOUT_MS,
} from "@/modules/network/services/snmp-optimized.constants";
import {
  resolveOnuDataTimeout,
  type OnuDatasetCollection,
} from "./snmp-optimized.helpers";
import { snmpWalkOptimized } from "./snmp-walk-executor.service";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";
import { SnmpCacheService } from "./snmp-cache.service";

const STATUS_BASE_OID = "1.3.6.1.4.1.3902.1012.3.28.1.1";
const STATUS_NEW_OID = "1.3.6.1.4.1.3902.1012.3.28.2.1.4";
const STATUS_OLD_OID = `${STATUS_BASE_OID}.6`;
const ONU_NAME_OID = `${STATUS_BASE_OID}.2`;
const ONU_SERIAL_OID = `${STATUS_BASE_OID}.5`;
const ONU_DESC_OID = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3";
const ONU_RX_OLT_OID = "1.3.6.1.4.1.3902.1015.1010.11.2.1.2";
const ONU_RX_ONU_OID = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10";
const ONU_ACTUAL_TYPE_OID = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9";
const ONU_PPPOE_OID = "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11";

async function fetchSnmpDataset(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number,
  connectionPool: SNMPConnectionPoolService,
  cacheService: SnmpCacheService,
): Promise<Record<string, string>> {
  return snmpWalkOptimized(
    ipAddress,
    port,
    community,
    version,
    oid,
    connectionPool,
    { useCache: true, timeout, cacheService },
  ).catch(() => ({}));
}

export async function fetchStatusDataset(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  connectionPool: SNMPConnectionPoolService,
  _cacheService: SnmpCacheService,
): Promise<Record<string, string>> {
  const newStatusData = await snmpWalkOptimized(
    ipAddress,
    port,
    community,
    version,
    STATUS_NEW_OID,
    connectionPool,
    { useCache: false, timeout: SNMP_TIMEOUT_MS },
  ).catch(() => ({}));

  if (Object.keys(newStatusData).length > 0) {
    return newStatusData;
  }

  return snmpWalkOptimized(
    ipAddress,
    port,
    community,
    version,
    STATUS_OLD_OID,
    connectionPool,
    {
      useCache: false,
      timeout: SNMP_TIMEOUT_MS,
      chunkSize: MAX_CHUNK_SIZE,
    },
  ).catch(() => ({}));
}

export async function fetchOnuDatasets(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  totalOnus: number,
  statusData: Record<string, string>,
  connectionPool: SNMPConnectionPoolService,
  cacheService: SnmpCacheService,
): Promise<OnuDatasetCollection> {
  const timeout = resolveOnuDataTimeout(totalOnus);

  const fetch = (oid: string) =>
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      oid,
      timeout,
      connectionPool,
      cacheService,
    );

  const [
    nameData,
    descData,
    rxOltData,
    rxOnuData,
    snData,
    actualTypeData,
    pppoeData,
  ] = await Promise.all([
    fetch(ONU_NAME_OID),
    fetch(ONU_DESC_OID),
    fetch(ONU_RX_OLT_OID),
    fetch(ONU_RX_ONU_OID),
    fetch(ONU_SERIAL_OID),
    fetch(ONU_ACTUAL_TYPE_OID),
    fetch(ONU_PPPOE_OID),
  ]);

  return {
    statusData,
    nameData,
    descData,
    rxOltData,
    rxOnuData,
    snData,
    actualTypeData,
    pppoeData,
  };
}
