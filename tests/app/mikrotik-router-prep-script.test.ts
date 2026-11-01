import { describe, expect, it } from "vitest";

import { buildRouterPrepScript } from "@/app/admin/network/mikrotik/routerPrepScript";

/**
 * Script persiapan router publik: yang harus ditempel operator sebelum
 * "Tes Koneksi" bisa lulus. Nilai yang diharapkan ditulis tangan.
 */

const API_SERVICE_8730 =
  "/ip service set [find name=api] disabled=no port=8730";
// Password `pa"s$` harus ter-escape; user yang sudah ada tidak boleh diubah.
const ADD_USER_IF_ABSENT =
  ':if ([:len [/user find name="teknisi"]] = 0) do={ /user add name="teknisi" group=full password="pa\\"s\\$" comment="NetManager" } else={ :put "User API sudah ada di router; tidak diubah" }';

describe("buildRouterPrepScript", () => {
  it.each([
    {
      mode: "RADIUS" as const,
      want: [
        API_SERVICE_8730,
        ADD_USER_IF_ABSENT,
        "/ppp aaa set use-radius=yes",
        "",
      ].join("\n"),
    },
    {
      mode: "MIKROTIK_API" as const,
      want: [API_SERVICE_8730, ADD_USER_IF_ABSENT, ""].join("\n"),
    },
  ])("mode PPP $mode", ({ mode, want }) => {
    expect(
      buildRouterPrepScript({
        apiPort: 8730,
        apiUsername: "teknisi",
        apiPassword: 'pa"s$',
        pppConnectionMode: mode,
      }),
    ).toBe(want);
  });

  it.each([
    { apiUsername: "", apiPassword: "rahasia" },
    { apiUsername: "   ", apiPassword: "rahasia" },
    { apiUsername: "teknisi", apiPassword: "" },
  ])(
    "tanpa username/password tidak ada script ($apiUsername|$apiPassword)",
    (credentials) => {
      expect(
        buildRouterPrepScript({
          apiPort: 8728,
          pppConnectionMode: "RADIUS",
          ...credentials,
        }),
      ).toBeNull();
    },
  );
});
