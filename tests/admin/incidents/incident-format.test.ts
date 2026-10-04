import { describe, expect, it } from "vitest";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_HINT,
  INCIDENT_SEVERITY_LABEL,
  incidentStatusBadge,
  parseAffectedAreas,
} from "@/app/admin/incidents/incident-format";

describe("format insiden", () => {
  it("area terdampak dipisah koma, spasi & butir kosong dibuang", () => {
    expect(parseAffectedAreas(" Site A, ,Site B ,")).toEqual(["Site A", "Site B"]);
    expect(parseAffectedAreas("")).toEqual([]);
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
