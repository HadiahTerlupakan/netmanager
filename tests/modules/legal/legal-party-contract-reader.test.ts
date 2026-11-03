import { describe, expect, it, vi } from "vitest";

import type { PartyContractRow } from "@/modules/legal/repositories/LegalPartyContractRepository";
import { LegalPartyContractReader } from "@/modules/legal/services/LegalPartyContractReader";

const NOW = new Date("2026-11-03T05:00:00.000Z");

describe("LegalPartyContractReader", () => {
  it("menghitung sisa hari WIB dan apakah kontrak sudah mulai", async () => {
    const source = {
      findMonitoredContracts: vi.fn().mockResolvedValue([
        {
          id: "d1",
          partyId: "r1",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-11-13T00:00:00.000Z"),
          renewedBy: null,
        },
        {
          id: "d2",
          partyId: "r2",
          startDate: new Date("2026-12-01T00:00:00.000Z"),
          endDate: null,
          renewedBy: null,
        },
        {
          id: "d3",
          partyId: null,
          startDate: null,
          endDate: null,
          renewedBy: null,
        },
      ]),
    };

    const result = await new LegalPartyContractReader(
      source,
    ).listMonitoredContracts({
      tenantId: "tenant-1",
      partyType: "RESELLER",
      partyIds: ["r1", "r2"],
      now: NOW,
    });

    expect(source.findMonitoredContracts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", partyType: "RESELLER" }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        documentId: "d1",
        partyId: "r1",
        daysLeft: 10,
        hasStarted: true,
      }),
      expect.objectContaining({
        documentId: "d2",
        partyId: "r2",
        daysLeft: null,
        hasStarted: false,
      }),
    ]);
  });

  describe("kontrak yang sudah diperpanjang", () => {
    const OLD_END = new Date("2026-11-20T00:00:00.000Z");
    const RENEWAL_START = new Date("2026-11-21T00:00:00.000Z");
    const RENEWAL_END = new Date("2027-11-20T00:00:00.000Z");

    function readerWith(rows: unknown[]) {
      return new LegalPartyContractReader({
        findMonitoredContracts: vi.fn().mockResolvedValue(rows),
      });
    }

    function oldContract(renewedBy: unknown) {
      return {
        id: "old",
        partyId: "r1",
        startDate: new Date("2025-11-21T00:00:00.000Z"),
        endDate: OLD_END,
        renewedBy,
      };
    }

    const renewalRow = {
      id: "new",
      partyId: "r1",
      startDate: RENEWAL_START,
      endDate: RENEWAL_END,
      renewedBy: null as PartyContractRow["renewedBy"],
    };

    const list = (reader: LegalPartyContractReader) =>
      reader.listMonitoredContracts({
        tenantId: "tenant-1",
        partyType: "RESELLER",
        partyIds: ["r1"],
        now: NOW,
      });

    it("kontrak lama tetap berlaku sampai pengganti bersambung mulai, dengan akhir efektif pengganti", async () => {
      const result = await list(
        readerWith([
          oldContract({
            startDate: RENEWAL_START,
            endDate: RENEWAL_END,
            terminatedAt: null,
          }),
          renewalRow,
        ]),
      );

      expect(result).toEqual([
        expect.objectContaining({
          documentId: "old",
          hasStarted: true,
          endDate: RENEWAL_END,
          daysLeft: 382,
        }),
        expect.objectContaining({ documentId: "new", hasStarted: false }),
      ]);
    });

    it("pengganti dengan jeda tidak memperpanjang akhir efektif kontrak lama", async () => {
      const result = await list(
        readerWith([
          oldContract({
            startDate: new Date("2027-02-01T00:00:00.000Z"),
            endDate: RENEWAL_END,
            terminatedAt: null,
          }),
        ]),
      );

      expect(result[0]).toMatchObject({ endDate: OLD_END, daysLeft: 17 });
    });

    it("kontrak lama dibuang setelah penggantinya berlaku", async () => {
      const result = await list(
        readerWith([
          oldContract({
            startDate: new Date("2026-11-01T00:00:00.000Z"),
            endDate: RENEWAL_END,
            terminatedAt: null,
          }),
        ]),
      );

      expect(result).toEqual([]);
    });

    it("pengganti yang diakhiri tidak dihitung; kontrak lama memakai tanggalnya sendiri", async () => {
      const result = await list(
        readerWith([
          oldContract({
            startDate: RENEWAL_START,
            endDate: RENEWAL_END,
            terminatedAt: new Date("2026-11-02T00:00:00.000Z"),
          }),
        ]),
      );

      expect(result[0]).toMatchObject({ documentId: "old", endDate: OLD_END });
    });
  });
});
