// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IsolirModeField } from "@/app/admin/network/mikrotik/components/IsolirModeField";

import {
  bongkarPanggung,
  cari,
  pasangPanggung,
  render,
  type Panggung,
} from "./presurvei-jsdom-harness";

const SELECT = "#mikrotik-isolir-mode";

function opsi(): string[] {
  const select = cari<HTMLSelectElement>(SELECT);
  return Array.from(select?.options ?? []).map((o) => o.value);
}

describe("IsolirModeField opsi Server isolir", () => {
  let panggung: Panggung;

  beforeEach(() => {
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
  });

  const field = (connectionMode?: "PUBLIC" | "VPN") => (
    <IsolirModeField
      mode="ROUTER_PAGE"
      url=""
      connectionMode={connectionMode}
      onModeChange={() => {}}
      onUrlChange={() => {}}
    />
  );

  it("muncul untuk router VPN", async () => {
    await render(panggung, field("VPN"));

    expect(opsi()).toContain("ISOLIR_SERVICE");
    expect(cari(SELECT)?.textContent).toContain("Server isolir");
  });

  it.each([["PUBLIC" as const], [undefined]])(
    "tidak muncul untuk connectionMode %s",
    async (mode) => {
      await render(panggung, field(mode));

      expect(opsi()).toEqual(["ROUTER_PAGE", "REDIRECT"]);
    },
  );
});
