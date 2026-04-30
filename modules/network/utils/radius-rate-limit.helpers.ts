type RateLimitInput = {
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

/** Build burst limit segment when any burst limit exists. */
export function buildBurstLimitSegment(input: RateLimitInput): string | null {
  if (!input.burstLimitUpload && !input.burstLimitDownload) {
    return null;
  }

  const burstRx = input.burstLimitUpload || input.maxLimitUpload;
  const burstTx = input.burstLimitDownload || input.maxLimitDownload;
  return `${burstRx}/${burstTx}`;
}

/** Build burst threshold segment when any threshold exists. */
export function buildBurstThresholdSegment(
  input: RateLimitInput,
): string | null {
  if (!input.burstThresholdUpload && !input.burstThresholdDownload) {
    return null;
  }

  const thresholdRx = input.burstThresholdUpload || input.maxLimitUpload;
  const thresholdTx = input.burstThresholdDownload || input.maxLimitDownload;
  return `${thresholdRx}/${thresholdTx}`;
}

/** Build burst time segment when any burst time exists. */
export function buildBurstTimeSegment(input: RateLimitInput): string | null {
  if (!input.burstTimeUpload && !input.burstTimeDownload) {
    return null;
  }

  const timeRx = input.burstTimeUpload || 1;
  const timeTx = input.burstTimeDownload || input.burstTimeUpload || 1;
  return `${timeRx}/${timeTx}`;
}

/** Build minimum limit segment when any minimum limit exists. */
export function buildMinLimitSegment(input: RateLimitInput): string | null {
  if (!input.minLimitUpload && !input.minLimitDownload) {
    return null;
  }

  const minRx = input.minLimitUpload || input.maxLimitUpload;
  const minTx = input.minLimitDownload || input.maxLimitDownload;
  return `${minRx}/${minTx}`;
}
