import {
  STATUS_DATASET_THRESHOLD,
  SMALL_DATA_TIMEOUT_MS,
  SNMP_TIMEOUT_MS,
} from "./snmp-optimized.constants";

export type OnuItem = {
  oltId: string;
  name: string;
  description: string | null;
  pppoe: string | null;
  gponOnu: string;
  status: string;
  rxOlt: string | null;
  rxOnu: string | null;
  serialNumber: string | null;
  actualType: string | null;
};

export type OnuDatasetCollection = {
  statusData: Record<string, string>;
  nameData: Record<string, string>;
  descData: Record<string, string>;
  rxOltData: Record<string, string>;
  rxOnuData: Record<string, string>;
  snData: Record<string, string>;
  actualTypeData: Record<string, string>;
  pppoeData: Record<string, string>;
};

/** Pilih timeout fetch berdasarkan ukuran dataset ONU. */
export function resolveOnuDataTimeout(totalOnus: number): number {
  return totalOnus > STATUS_DATASET_THRESHOLD
    ? SNMP_TIMEOUT_MS
    : SMALL_DATA_TIMEOUT_MS;
}

/** Ubah status numerik ONU menjadi label yang dipakai UI. */
export function mapOnuStatus(statusValue: string): string {
  const statusNum = parseInt(statusValue, 10);

  if (statusNum === 1) return "LOS";
  if (statusNum === 3) return "Online";
  if (statusNum === 4) return "DyingGasp";
  if (statusNum === 6) return "OffLine";

  return "Unknown";
}

/** Format nilai RX OLT mentah ke dBm. */
export function formatRxOlt(rxOltValue: string): string {
  const rxOltNum = parseInt(rxOltValue, 10);

  if (Number.isNaN(rxOltNum) || rxOltNum <= -80000) {
    return "N/A";
  }

  return `${(rxOltNum / 1000).toFixed(3)} dBm`;
}

/** Format nilai RX ONU mentah ke dBm. */
export function formatRxOnu(rxOnuValue: string): string {
  const rxOnuNum = parseInt(rxOnuValue, 10);

  if (Number.isNaN(rxOnuNum) || rxOnuNum <= 0 || rxOnuNum === 65535) {
    return "N/A";
  }

  return `${(-30 + rxOnuNum * 0.002).toFixed(3)} dBm`;
}

/** Bentuk label GPON ONU dari index komposit SNMP. */
function getInvalidOnuLabel(index: string) {
  return `idx-${index}`;
}

function parseCompositeOnuIndex(index: string) {
  const indexParts = index.split(".");
  if (indexParts.length < 2) {
    return null;
  }

  const compositeIndex = parseInt(indexParts[0], 10);
  if (Number.isNaN(compositeIndex)) {
    return null;
  }

  return { compositeIndex, onuId: indexParts[1] };
}

export function buildGponOnuLabel(index: string): string {
  const parsedIndex = parseCompositeOnuIndex(index);
  if (!parsedIndex) {
    return getInvalidOnuLabel(index);
  }

  const shelf = (parsedIndex.compositeIndex >> 24) & 0xf;
  const slot = (parsedIndex.compositeIndex >> 16) & 0xff;
  const port = (parsedIndex.compositeIndex >> 8) & 0xff;
  const frame = shelf === 0 ? 1 : shelf;

  return `${frame}/${slot}/${port}:${parsedIndex.onuId}`;
}

function resolveOnuName(index: string, nameData: Record<string, string>) {
  return nameData[index] || `ONU-${index.split(".")[1]}`;
}

/** Cari nilai PPPoE dengan fallback ke suffix ONU id. */
export function resolvePppoeValue(
  index: string,
  pppoeData: Record<string, string>,
): string {
  const directValue = pppoeData[index] || "";
  if (directValue) {
    return directValue;
  }

  const indexParts = index.split(".");
  if (indexParts.length < 2) {
    return "";
  }

  const onuId = indexParts[1];
  const matchingKey = Object.keys(pppoeData).find((key) =>
    key.endsWith(`.${onuId}`),
  );

  return matchingKey ? pppoeData[matchingKey] || "" : "";
}

/** Cari nilai RX ONU dengan fallback index tambahan .1. */
export function resolveRxOnuValue(
  index: string,
  rxOnuData: Record<string, string>,
): string {
  return rxOnuData[index] || rxOnuData[`${index}.1`] || "";
}

/** Bentuk item ONU untuk satu index hasil paginasi. */
export function buildOnuItem(params: {
  index: string;
  oltId: string;
  datasets: OnuDatasetCollection;
}): OnuItem {
  const { index, oltId, datasets } = params;

  return {
    oltId,
    name: resolveOnuName(index, datasets.nameData),
    description: datasets.descData[index] || null,
    pppoe: resolvePppoeValue(index, datasets.pppoeData) || null,
    gponOnu: buildGponOnuLabel(index),
    status: mapOnuStatus(datasets.statusData[index] || ""),
    rxOlt: formatRxOlt(datasets.rxOltData[index] || ""),
    rxOnu: formatRxOnu(resolveRxOnuValue(index, datasets.rxOnuData)),
    serialNumber: datasets.snData[index] || null,
    actualType: datasets.actualTypeData[index] || null,
  };
}
