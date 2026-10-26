// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionsTable } from "@/components/admin/radius/sessions-table";
import { StatsCards } from "@/components/admin/radius/stats-cards";

/**
 * Regresi: pemakaian kecil tampil "0 B". Kartu dan tabel dulu memformat dari
 * GB/MB yang sudah dibulatkan dua desimal oleh API, sehingga 1.768 byte
 * menjadi 0 GB lalu "0 B"; byte aslinya ada di respons yang sama.
 */

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("tampilan pemakaian RADIUS", () => {
  it("Traffic Today memakai byte asli", () => {
    act(() =>
      root.render(
        <StatsCards
          totalUsers={2}
          onlineUsers={1}
          offlineUsers={1}
          trafficToday={{ downloadBytes: "1768", uploadBytes: "14558" }}
        />,
      ),
    );
    expect(container.textContent).toContain("↓ 1.73 KB | ↑ 14.2 KB");
    expect(container.textContent).not.toContain("0 B");
  });

  it("kolom usage sesi memakai octet asli", () => {
    act(() =>
      root.render(
        <SessionsTable
          sessions={[
            {
              radAcctId: "232",
              username: "tes-lab-02",
              nasIpAddress: "10.100.0.4",
              framedIpAddress: "172.31.251.254/32",
              acctStartTime: "2026-10-26T23:02:28.000Z",
              uptimeHours: 0.19,
              acctInputOctets: "8542",
              acctOutputOctets: "442",
              isOnline: true,
            },
          ]}
        />,
      ),
    );
    expect(container.textContent).toContain("442 B / 8.34 KB");
  });

  it("nol tetap 0 B", () => {
    act(() =>
      root.render(
        <StatsCards
          totalUsers={0}
          onlineUsers={0}
          offlineUsers={0}
          trafficToday={{ downloadBytes: "0", uploadBytes: "0" }}
        />,
      ),
    );
    expect(container.textContent).toContain("↓ 0 B | ↑ 0 B");
  });
});
