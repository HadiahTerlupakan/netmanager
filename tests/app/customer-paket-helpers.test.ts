import { describe, expect, it } from "vitest";
import {
  classifyIpAddress,
  formatBillingPeriod,
} from "@/app/(customer)/paket/paket-helpers";

describe("classifyIpAddress", () => {
  it.each([
    ["10.1.2.3", "Privat"],
    ["172.16.0.1", "Privat"],
    ["172.31.251.254", "Privat"],
    ["192.168.88.10", "Privat"],
    ["100.64.0.1", "Privat"],
    ["100.127.255.254", "Privat"],
    ["172.32.0.1", "Publik"],
    ["100.128.0.1", "Publik"],
    ["103.10.20.30", "Publik"],
  ])("%s tergolong %s", (ip, jenis) => {
    expect(classifyIpAddress(ip)).toBe(jenis);
  });

  it("menerima alamat dengan prefix inet seperti dikirim API", () => {
    expect(classifyIpAddress("172.31.251.254/32")).toBe("Privat");
    expect(classifyIpAddress("103.10.20.30/32")).toBe("Publik");
  });

  it("mengembalikan null untuk alamat yang bukan IPv4", () => {
    expect(classifyIpAddress("bukan-ip")).toBeNull();
    expect(classifyIpAddress("10.0.0.256")).toBeNull();
  });
});

describe("formatBillingPeriod", () => {
  const aktifLama = "2024-01-01T00:00:00.000+07:00";

  it("menyebut tahun awal saat periode melintasi tahun", () => {
    expect(
      formatBillingPeriod("2027-01-05T00:00:00.000+07:00", aktifLama),
    ).toBe("5 Des 2026 - 5 Jan 2027");
  });

  it("mundur satu bulan dengan aman di akhir bulan, seperti addSafeMonth", () => {
    expect(
      formatBillingPeriod("2027-03-31T00:00:00.000+07:00", aktifLama),
    ).toBe("28 Feb - 31 Mar 2027");
  });

  it("memulai periode pertama dari tanggal aktif bila lebih baru", () => {
    expect(
      formatBillingPeriod(
        "2026-11-23T00:00:00.000+07:00",
        "2026-11-01T00:00:00.000+07:00",
      ),
    ).toBe("1 Nov - 23 Nov 2026");
  });
});
