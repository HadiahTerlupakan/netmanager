import {
  buildBurstLimitSegment,
  buildBurstThresholdSegment,
  buildBurstTimeSegment,
  buildMinLimitSegment,
} from "./radius-rate-limit.helpers";

const BITS_PER_MEGABIT = 1_000_000;
const DISABLED_PAIR = "0/0";
const DEFAULT_PRIORITY = "8";

type MikroTikRateLimitInput = {
  maxLimitUpload: string;
  maxLimitDownload: string;
  burstLimitUpload?: string | null;
  burstLimitDownload?: string | null;
  burstThresholdUpload?: string | null;
  burstThresholdDownload?: string | null;
  burstTimeUpload?: number | null;
  burstTimeDownload?: number | null;
  priority?: number | null;
  minLimitUpload?: string | null;
  minLimitDownload?: string | null;
};

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
export function buildMikrotikRateLimit(input: MikroTikRateLimitInput): string {
  return buildRateLimitSegments(input).join(" ");
}

// RouterOS reads the rate-limit by position, so a later value needs every
// earlier slot written: "4M/6M 5 1M/2M" makes 5 the burst limit and the
// session fails to get a queue. 0/0 leaves burst off; 8 is the default
// priority.
function buildRateLimitSegments(input: MikroTikRateLimitInput): string[] {
  const optional: Array<[string | null, string]> = [
    [buildBurstLimitSegment(input), DISABLED_PAIR],
    [buildBurstThresholdSegment(input), DISABLED_PAIR],
    [buildBurstTimeSegment(input), DISABLED_PAIR],
    [input.priority ? String(input.priority) : null, DEFAULT_PRIORITY],
    [buildMinLimitSegment(input), DISABLED_PAIR],
  ];
  const lastSet = optional.findLastIndex(([segment]) => segment !== null);
  const filled = optional
    .slice(0, lastSet + 1)
    .map(([segment, filler]) => segment ?? filler);
  return [`${input.maxLimitUpload}/${input.maxLimitDownload}`, ...filled];
}
