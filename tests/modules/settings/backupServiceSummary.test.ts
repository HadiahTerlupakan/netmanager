import { describe, expect, it } from "vitest";

import { summarizeBackupResults } from "@/modules/settings/services/backupService";

describe("summarizeBackupResults", () => {
  it("summarizes all-success import results", () => {
    const summary = summarizeBackupResults("Import", [
      { database: "netmanager", status: "success", message: "ok" },
      { database: "radius", status: "success", message: "ok" },
    ]);

    expect(summary).toEqual({
      success: true,
      message: "Import berhasil: 2 database berhasil di-restore.",
    });
  });

  it("summarizes reset results with errors", () => {
    const summary = summarizeBackupResults("Reset", [
      { database: "netmanager", status: "success", message: "ok" },
      { database: "radius", status: "error", message: "failed" },
    ]);

    expect(summary).toEqual({
      success: false,
      message: "Reset selesai dengan 1 error. 1 langkah berhasil.",
    });
  });
});
