import type { MikroTikBandwidthRate } from "./ppp-profile.types";

/** Format RouterOS PPP rate-limit from bandwidth settings. */
export function formatRateLimitFromBandwidth(
  bandwidth: MikroTikBandwidthRate,
): string {
  let rateLimit = `${bandwidth.maxLimitDownload}/${bandwidth.maxLimitUpload}`;
  rateLimit += formatBurstLimit(bandwidth);
  rateLimit += formatBurstThreshold(bandwidth);
  rateLimit += formatBurstTime(bandwidth);
  rateLimit += formatPriority(bandwidth);
  rateLimit += formatMinLimit(bandwidth);
  return rateLimit;
}

function formatBurstLimit(bandwidth: MikroTikBandwidthRate) {
  if (!bandwidth.burstLimitDownload && !bandwidth.burstLimitUpload) return "";
  const burstRx = bandwidth.burstLimitDownload || bandwidth.maxLimitDownload;
  const burstTx = bandwidth.burstLimitUpload || bandwidth.maxLimitUpload;
  return ` ${burstRx}/${burstTx}`;
}

function formatBurstThreshold(bandwidth: MikroTikBandwidthRate) {
  if (!bandwidth.burstThresholdDownload && !bandwidth.burstThresholdUpload) {
    return "";
  }
  const thresholdRx =
    bandwidth.burstThresholdDownload || bandwidth.maxLimitDownload;
  const thresholdTx =
    bandwidth.burstThresholdUpload || bandwidth.maxLimitUpload;
  return ` ${thresholdRx}/${thresholdTx}`;
}

function formatBurstTime(bandwidth: MikroTikBandwidthRate) {
  if (!bandwidth.burstTimeDownload && !bandwidth.burstTimeUpload) return "";
  const timeRx = bandwidth.burstTimeDownload || 1;
  const timeTx = bandwidth.burstTimeUpload || bandwidth.burstTimeDownload || 1;
  return ` ${timeRx}/${timeTx}`;
}

function formatPriority(bandwidth: MikroTikBandwidthRate) {
  return bandwidth.priority ? ` ${bandwidth.priority}` : "";
}

function formatMinLimit(bandwidth: MikroTikBandwidthRate) {
  if (!bandwidth.minLimitDownload && !bandwidth.minLimitUpload) return "";
  const minRx = bandwidth.minLimitDownload || bandwidth.maxLimitDownload;
  const minTx = bandwidth.minLimitUpload || bandwidth.maxLimitUpload;
  return ` ${minRx}/${minTx}`;
}
