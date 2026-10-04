import { describe, expect, it } from "vitest";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_HINT,
  INCIDENT_SEVERITY_LABEL,
  incidentStatusBadge,
  MAX_AFFECTED_AREAS,
  addCustomArea,
  hasAffectedArea,
  toggleAffectedArea,
} from "@/app/admin/incidents/incident-format";

describe("format insiden", () => {
  it("centang site menambah, centang ulang melepas — tanpa membedakan huruf", () => {
    const selected = toggleAffectedArea([], "Site Cibeber");
    expect(selected).toEqual(["Site Cibeber"]);
    expect(hasAffectedArea(selected, "site cibeber")).toBe(true);
    expect(toggleAffectedArea(selected, "SITE CIBEBER")).toEqual([]);
  });

  it("area ketikan dirapikan; kosong, ganda, dan kepanjangan diabaikan", () => {
    expect(addCustomArea([], "  Desa Sukamaju ")).toEqual(["Desa Sukamaju"]);
    expect(addCustomArea(["Desa Sukamaju"], "desa sukamaju")).toEqual(["Desa Sukamaju"]);
    expect(addCustomArea([], "   ")).toEqual([]);
    expect(addCustomArea([], "x".repeat(101))).toEqual([]);
  });

  it("tidak melebihi batas jumlah area server", () => {
    const full = Array.from({ length: MAX_AFFECTED_AREAS }, (_, index) => `Area ${index}`);
    expect(toggleAffectedArea(full, "Site Baru")).toHaveLength(MAX_AFFECTED_AREAS);
    expect(addCustomArea(full, "Desa Baru")).toHaveLength(MAX_AFFECTED_AREAS);
  });

  it("setiap tingkat gangguan punya label dan penjelasan", () => {
    for (const severity of INCIDENT_SEVERITIES) {
      expect(INCIDENT_SEVERITY_LABEL[severity]).toBeTruthy();
      expect(INCIDENT_SEVERITY_HINT[severity]).toBeTruthy();
    }
  });

  it("lencana selesai berbeda dari yang masih berlangsung", () => {
    expect(incidentStatusBadge("RESOLVED")).not.toBe(incidentStatusBadge("MONITORING"));
    expect(incidentStatusBadge("INVESTIGATING")).toBe(incidentStatusBadge("IDENTIFIED"));
  });
});
