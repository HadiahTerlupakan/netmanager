import {
  buildBurstLimitSegment,
  buildBurstThresholdSegment,
  buildBurstTimeSegment,
  buildMinLimitSegment,
} from "./radius-rate-limit.helpers";

const BITS_PER_MEGABIT = 1_000_000;

type MikroTikRateLimitInput = {
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

function buildRateLimitSegments(input: MikroTikRateLimitInput): string[] {
  const segments = [`${input.maxLimitUpload}/${input.maxLimitDownload}`];
  appendSegment(segments, buildBurstLimitSegment(input));
  appendSegment(segments, buildBurstThresholdSegment(input));
  appendSegment(segments, buildBurstTimeSegment(input));
  appendSegment(segments, input.priority ? String(input.priority) : null);
  appendSegment(segments, buildMinLimitSegment(input));
  return segments;
}

function appendSegment(segments: string[], segment: string | null): void {
  if (segment) {
    segments.push(segment);
  }
}
