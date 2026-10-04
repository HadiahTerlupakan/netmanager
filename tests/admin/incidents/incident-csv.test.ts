import { describe, expect, it } from "vitest";
import type { IncidentRow } from "@/app/admin/incidents/IncidentListItem";
import { buildIncidentCsv } from "@/app/admin/incidents/incident-csv";
import { todayForFileName } from "@/lib/download";

const INCIDENT: IncidentRow = {
  id: "inc-1",
  title: "Gangguan area Selatan",
  description: "=HYPERLINK(\"x\") putus, \"fiber\" terpotong",
  severity: "CRITICAL",
  status: "RESOLVED",
  affectedAreas: ["Headquarters", "Desa Sukamaju"],
  startedAt: "2026-10-04T03:00:00.000Z",
  resolvedAt: null,
  isPublic: false,
};

describe("CSV insiden", () => {
  it("berkolom label Indonesia dan satu baris per insiden", () => {
    const [header, row, extra] = buildIncidentCsv([INCIDENT]).split("\n");

    expect(header).toBe(
      '"Judul","Tingkat","Status","Area terdampak","Mulai","Selesai","Tampil publik","Deskripsi"',
    );
    expect(row).toContain('"Kritis","Selesai","Headquarters; Desa Sukamaju"');
    expect(row).toContain('"","Tidak"');
    expect(extra).toBeUndefined();
  });

  it("sel diawali rumus dinetralkan dan tanda kutip di-escape", () => {
    const row = buildIncidentCsv([INCIDENT]).split("\n")[1];

    expect(row).toContain(`"'=HYPERLINK(""x"") putus, ""fiber"" terpotong"`);
  });
});

describe("nama berkas unduhan", () => {
  it("memakai tanggal WIB", () => {
    expect(todayForFileName(new Date("2026-10-04T18:00:00Z"))).toBe("2026-10-05");
  });
});
