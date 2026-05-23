import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAuthFailureResponse,
  parseShowSessions,
  parseShowStat,
  parseTerminateResponse,
} from "@/modules/network/services/accel-ppp/parsers";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

describe("accel-ppp parsers", () => {
  describe("parseShowSessions", () => {
    it("parses multi-session output dengan kolom default", () => {
      const fixture = loadFixture("show-sessions-multi.txt");
      const sessions = parseShowSessions(fixture);

      expect(sessions).toHaveLength(3);
      expect(sessions[0]).toMatchObject({
        ifname: "ppp0",
        username: "budi.santoso",
        callingSid: "aa:bb:cc:dd:ee:01",
        ip: "10.10.0.12",
        rateLimit: "10240/10240",
        type: "pppoe",
        comp: null,
        state: "active",
        uptime: "02:14:33",
      });
      expect(sessions[2].state).toBe("start");
    });

    it("returns empty array kalau tidak ada baris data", () => {
      const fixture = loadFixture("show-sessions-empty.txt");
      const sessions = parseShowSessions(fixture);
      expect(sessions).toEqual([]);
    });

    it("ignore banner / prompt accel-ppp di awal output", () => {
      const fixture = loadFixture("show-sessions-multi.txt");
      const noisy = `accel-ppp version 1.12.0\naccel-ppp# show sessions\n${fixture}\naccel-ppp#`;
      const sessions = parseShowSessions(noisy);
      expect(sessions).toHaveLength(3);
    });

    it("memasukkan kolom non-standar ke extras", () => {
      const custom = [
        "ifname | username | sid    | ip         | rate-limit | type  | comp | state  | uptime",
        "-------+----------+--------+------------+------------+-------+------+--------+-------",
        "ppp0   | budi     | abc123 | 10.10.0.12 | 1000/1000  | pppoe |      | active | 00:01:00",
      ].join("\n");
      const sessions = parseShowSessions(custom);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].extras).toEqual({ sid: "abc123" });
    });

    it("kembalikan array kosong saat output bukan tabular", () => {
      expect(parseShowSessions("")).toEqual([]);
      expect(parseShowSessions("invalid output")).toEqual([]);
    });
  });

  describe("parseShowStat", () => {
    it("ekstrak metrik aktif/start/finish dari fixture", () => {
      const fixture = loadFixture("show-stat.txt");
      const stat = parseShowStat(fixture);

      expect(stat.cpuPercent).toBe(4);
      expect(stat.activeSessions).toBe(2);
      expect(stat.startingSessions).toBe(0);
      expect(stat.finishingSessions).toBe(0);
      expect(stat.raw["mempool_allocated"]).toBe("1245184");
    });

    it("default ke nol kalau blok sessions tidak ditemukan", () => {
      const stat = parseShowStat("cpu: 1%\ncore:\n  thread_count: 4\n");
      expect(stat.cpuPercent).toBe(1);
      expect(stat.activeSessions).toBe(0);
      expect(stat.startingSessions).toBe(0);
      expect(stat.finishingSessions).toBe(0);
    });
  });

  describe("parseTerminateResponse", () => {
    it("deteksi success dari fixture terminate-success", () => {
      const result = parseTerminateResponse(
        loadFixture("terminate-success.txt"),
      );
      expect(result.success).toBe(true);
      expect(result.notFound).toBe(false);
    });

    it("deteksi notFound dari fixture terminate-not-found", () => {
      const result = parseTerminateResponse(
        loadFixture("terminate-not-found.txt"),
      );
      expect(result.notFound).toBe(true);
      expect(result.success).toBe(false);
    });

    it("treat empty output sebagai sukses (server diam = OK)", () => {
      const result = parseTerminateResponse("");
      expect(result.success).toBe(true);
      expect(result.notFound).toBe(false);
    });
  });

  describe("isAuthFailureResponse", () => {
    it("true untuk fixture auth-failed", () => {
      expect(isAuthFailureResponse(loadFixture("auth-failed.txt"))).toBe(true);
    });

    it("false untuk output normal", () => {
      expect(
        isAuthFailureResponse(loadFixture("show-sessions-multi.txt")),
      ).toBe(false);
    });
  });
});
