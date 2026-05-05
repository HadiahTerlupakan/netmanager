import type {
  NasEntity,
  RadIpPoolEntity,
  RadiusSessionTotalsEntity,
  RadiusSessionViewEntity,
} from "../domain/entities/RadiusEntity";

interface RawRecentSessionRecord {
  radacctid: bigint | number;
  username: string | null;
  nasipaddress: string;
  framedipaddress: string | null;
  acctstarttime: Date | null;
  acctstoptime: Date | null;
  acctsessiontime: bigint | number | null;
  acctinputoctets: bigint | number | null;
  acctoutputoctets: bigint | number | null;
}
import {
  BYTES_PER_MB,
  ONE_HOUR_IN_SECONDS,
  PERCENT_PRECISION,
} from "./radiusRepository.constants";

function buildOptionalNasFields(nas: {
  shortname: string | null;
  type: string | null;
  ports: number | null;
  community: string | null;
  description: string | null;
}) {
  return {
    ...(nas.shortname ? { shortname: nas.shortname } : {}),
    ...(nas.type ? { type: nas.type } : {}),
    ...(nas.ports ? { ports: nas.ports } : {}),
    ...(nas.community ? { community: nas.community } : {}),
    ...(nas.description ? { description: nas.description } : {}),
  };
}

/** Convert NAS record to domain entity. */
export function toNasEntity(nas: {
  id: number;
  nasname: string;
  secret: string;
  shortname: string | null;
  type: string | null;
  ports: number | null;
  community: string | null;
  description: string | null;
}): NasEntity {
  return {
    id: nas.id,
    nasname: nas.nasname,
    secret: nas.secret,
    ...buildOptionalNasFields(nas),
  };
}

/** Convert IP pool record to domain entity. */
export function toRadIpPoolEntity(pool: {
  id: number;
  pool_name: string;
  framedipaddress: string;
  nasipaddress: string | null;
  pool_key: string | null;
}): RadIpPoolEntity {
  return {
    id: pool.id,
    poolName: pool.pool_name,
    framedIpAddress: pool.framedipaddress,
    ...(pool.nasipaddress ? { nasIpAddress: pool.nasipaddress } : {}),
    ...(pool.pool_key ? { poolKey: pool.pool_key } : {}),
  };
}

/** Round bytes to megabytes with two decimals. */
export function toRoundedMegabytes(totalBytes: number): number {
  return (
    Math.round((totalBytes / BYTES_PER_MB) * PERCENT_PRECISION) /
    PERCENT_PRECISION
  );
}

/** Convert grouped octet totals to session totals entity. */
export function toSessionTotalsEntity(
  inputBytes: number,
  outputBytes: number,
): RadiusSessionTotalsEntity {
  return {
    downloadMB: toRoundedMegabytes(outputBytes),
    uploadMB: toRoundedMegabytes(inputBytes),
  };
}

/** Convert raw RADIUS session to session view entity. */
export function toRecentSessionViewEntity(
  session: RawRecentSessionRecord,
  now: Date,
): RadiusSessionViewEntity {
  const startTime = session.acctstarttime || new Date();
  const isOnline = session.acctstoptime === null;
  const uptimeSeconds = getUptimeSeconds(session, now, startTime, isOnline);

  return {
    radAcctId: session.radacctid.toString(),
    username: session.username,
    nasIpAddress: session.nasipaddress,
    framedIpAddress: session.framedipaddress,
    acctStartTime: session.acctstarttime?.toISOString() || null,
    acctStopTime: session.acctstoptime?.toISOString() || null,
    acctSessionTime: session.acctsessiontime?.toString() || "0",
    acctInputOctets: session.acctinputoctets?.toString() || "0",
    acctOutputOctets: session.acctoutputoctets?.toString() || "0",
    uptimeSeconds,
    uptimeHours: toRoundedHours(uptimeSeconds),
    downloadMB: toRoundedMegabytes(Number(session.acctoutputoctets ?? 0)),
    uploadMB: toRoundedMegabytes(Number(session.acctinputoctets ?? 0)),
    isOnline,
  };
}

function getUptimeSeconds(
  session: RawRecentSessionRecord,
  now: Date,
  startTime: Date,
  isOnline: boolean,
): number {
  if (isOnline) {
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }

  if (!session.acctsessiontime) {
    return 0;
  }

  return Number(session.acctsessiontime);
}

function toRoundedHours(uptimeSeconds: number): number {
  const hours = uptimeSeconds / ONE_HOUR_IN_SECONDS;
  return Math.round(hours * PERCENT_PRECISION) / PERCENT_PRECISION;
}
