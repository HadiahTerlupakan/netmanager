import { describe, expect, it } from "vitest";

import {
  buildBandwidthPayload,
  createInitialBandwidthFormData,
} from "@/app/admin/paket/bandwidth/lib/bandwidthFormatting";

describe("buildBandwidthPayload", () => {
  it("mengirim null untuk parameter opsional yang dikosongkan agar server menghapusnya", () => {
    const payload = buildBandwidthPayload({
      ...createInitialBandwidthFormData(),
      name: "Paket",
      maxLimitDownloadValue: "6",
      maxLimitUploadValue: "4",
    });

    expect(JSON.parse(JSON.stringify(payload))).toMatchObject({
      burstLimitDownload: null,
      burstLimitUpload: null,
      minLimitDownload: null,
      minLimitUpload: null,
      burstThresholdDownload: null,
      burstThresholdUpload: null,
      burstTimeDownload: null,
      burstTimeUpload: null,
      priority: null,
    });
  });
});
