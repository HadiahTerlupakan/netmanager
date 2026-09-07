import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CNAME tidak boleh dipasang di apex sebuah zona (RFC 1034), jadi tenant yang
 * ingin memakai `domainklien.com` langsung hanya bisa memakai A record.
 * Verifikasi yang hanya menerima CNAME membuat domain apex tidak akan pernah
 * lolos — padahal itu bentuk yang paling sering diminta klien.
 */

const dns = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("node:dns/promises", () => ({ resolve: dns.resolve }));

const { DnsVerificationService } = await import("@/modules/tenant");

const OUR_IP = "203.0.113.10";

/** Jawaban DNS per (nama, tipe); selain itu dianggap tidak ada record. */
const withDnsRecords = (records: Record<string, Record<string, string[]>>) => {
  dns.resolve.mockImplementation(async (name: string, type: string) => {
    const answer = records[name]?.[type];
    if (!answer) throw new Error(`ENODATA ${name} ${type}`);
    return answer;
  });
};

let service: InstanceType<typeof DnsVerificationService>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DOMAIN = "radpro.id";
  service = new DnsVerificationService();
});

describe("verifyPointsToUs", () => {
  it("menerima CNAME ke domain utama", async () => {
    withDnsRecords({ "portal.klien.com": { CNAME: ["radpro.id"] } });

    expect(await service.verifyPointsToUs("portal.klien.com")).toBe(true);
  });

  it("menerima CNAME yang berakhir dengan titik", async () => {
    withDnsRecords({ "portal.klien.com": { CNAME: ["radpro.id."] } });

    expect(await service.verifyPointsToUs("portal.klien.com")).toBe(true);
  });

  // Inti perbaikan: domain apex hanya bisa memakai A record.
  it("menerima A record yang sama dengan domain utama", async () => {
    withDnsRecords({
      "klien.com": { A: [OUR_IP] },
      "radpro.id": { A: [OUR_IP] },
    });

    expect(await service.verifyPointsToUs("klien.com")).toBe(true);
  });

  it("menolak A record yang mengarah ke server lain", async () => {
    withDnsRecords({
      "klien.com": { A: ["198.51.100.7"] },
      "radpro.id": { A: [OUR_IP] },
    });

    expect(await service.verifyPointsToUs("klien.com")).toBe(false);
  });

  it("menolak CNAME ke domain pihak lain", async () => {
    withDnsRecords({ "portal.klien.com": { CNAME: ["contoh.lain.com"] } });

    expect(await service.verifyPointsToUs("portal.klien.com")).toBe(false);
  });

  it("menolak domain yang tidak punya record sama sekali", async () => {
    withDnsRecords({});

    expect(await service.verifyPointsToUs("belum-ada.klien.com")).toBe(false);
  });

  // Perbandingan memakai A record domain utama supaya perpindahan IP server
  // tidak perlu diikuti perubahan kode.
  it("membandingkan terhadap A record domain utama, bukan IP tertanam", async () => {
    withDnsRecords({
      "klien.com": { A: ["198.51.100.7"] },
      "radpro.id": { A: ["198.51.100.7"] },
    });

    expect(await service.verifyPointsToUs("klien.com")).toBe(true);
  });
});
