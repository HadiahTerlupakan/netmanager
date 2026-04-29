export interface IRadiusBandwidthSyncRepository {
  /** Sinkronkan satu bandwidth ke RADIUS. */
  syncBandwidthToRadius(bandwidthId: string): Promise<void>;
}
