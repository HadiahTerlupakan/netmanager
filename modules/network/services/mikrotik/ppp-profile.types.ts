export type PPPProfileData = {
  name: string;
  localAddress: string;
  remoteAddress: string;
  ipRange?: string | null;
  dnsServer?: string | null;
  sessionTimeout?: number | null;
  idleTimeout?: number | null;
  rateLimit?: string;
  skipPoolCheck?: boolean;
  skipRateLimit?: boolean;
};

export type MikroTikBandwidthRate = {
  maxLimitDownload: string;
  maxLimitUpload: string;
  burstLimitDownload?: string | null;
  burstLimitUpload?: string | null;
  burstThresholdDownload?: string | null;
  burstThresholdUpload?: string | null;
  burstTimeDownload?: number | null;
  burstTimeUpload?: number | null;
  priority?: number | null;
  minLimitDownload?: string | null;
  minLimitUpload?: string | null;
};
