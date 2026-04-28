const BITS_PER_MEGABIT = 1_000_000;

/** Ubah bandwidth Mbps menjadi format rate-limit RADIUS. */
export function toRadiusRateLimitMbps(input: {
  uploadMbps: number;
  downloadMbps: number;
}): string {
  const uploadBps = input.uploadMbps * BITS_PER_MEGABIT;
  const downloadBps = input.downloadMbps * BITS_PER_MEGABIT;
  return `${uploadBps}/${downloadBps}`;
}

/** Parse format rate-limit RADIUS menjadi nilai Mbps. */
export function parseRadiusRateLimitMbps(value: string): {
  uploadMbps: number;
  downloadMbps: number;
} {
  const [uploadBps = 0, downloadBps = 0] = value.split("/").map(Number);

  return {
    uploadMbps: uploadBps / BITS_PER_MEGABIT,
    downloadMbps: downloadBps / BITS_PER_MEGABIT,
  };
}

/** Bangun format rate-limit paket MikroTik dari konfigurasi bandwidth. */
export function buildMikrotikRateLimit(input: {
  maxLimitUpload: string;
  maxLimitDownload: string;
  burstLimitUpload: string | null;
  burstLimitDownload: string | null;
  burstThresholdUpload: string | null;
  burstThresholdDownload: string | null;
  burstTimeUpload: number | null;
  burstTimeDownload: number | null;
  priority: number | null;
  minLimitUpload: string | null;
  minLimitDownload: string | null;
}): string {
  let rateLimit = `${input.maxLimitUpload}/${input.maxLimitDownload}`;

  if (input.burstLimitUpload || input.burstLimitDownload) {
    const burstRx = input.burstLimitUpload || input.maxLimitUpload;
    const burstTx = input.burstLimitDownload || input.maxLimitDownload;
    rateLimit += ` ${burstRx}/${burstTx}`;
  }

  if (input.burstThresholdUpload || input.burstThresholdDownload) {
    const thresholdRx = input.burstThresholdUpload || input.maxLimitUpload;
    const thresholdTx = input.burstThresholdDownload || input.maxLimitDownload;
    rateLimit += ` ${thresholdRx}/${thresholdTx}`;
  }

  if (input.burstTimeUpload || input.burstTimeDownload) {
    const timeRx = input.burstTimeUpload || 1;
    const timeTx = input.burstTimeDownload || input.burstTimeUpload || 1;
    rateLimit += ` ${timeRx}/${timeTx}`;
  }

  if (input.priority) {
    rateLimit += ` ${input.priority}`;
  }

  if (input.minLimitUpload || input.minLimitDownload) {
    const minRx = input.minLimitUpload || input.maxLimitUpload;
    const minTx = input.minLimitDownload || input.maxLimitDownload;
    rateLimit += ` ${minRx}/${minTx}`;
  }

  return rateLimit;
}
