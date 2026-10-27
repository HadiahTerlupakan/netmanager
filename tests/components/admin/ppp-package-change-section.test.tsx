// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PppClientPackageChangeSection,
  type PackageChangeDirection,
} from "@/app/admin/pelanggan/ppp/components/package/PppClientPackageChangeSection";

/**
 * Regresi: pindah antara dua paket berharga sama (paket lab Rp0) dilabeli
 * "Upgrade" dan menawarkan "Tagih selisih prorate", padahal selisihnya nol;
 * penurunan 10M ke 5M di lab pun tampil sebagai Upgrade.
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

function render(direction: PackageChangeDirection) {
  act(() =>
    root.render(
      <PppClientPackageChangeSection
        prorateOption="NONE"
        downgradeAdjustment="NONE"
        upgradeApplyTime="IMMEDIATE"
        direction={direction}
        loading={false}
        onFieldChange={() => {}}
        roundedClassName="rounded-lg"
      />,
    ),
  );
  const options = [
    ...container.querySelectorAll<HTMLOptionElement>("#prorateOption option"),
  ].map((o) => o.value);
  return { text: container.textContent ?? "", options };
}

describe("PppClientPackageChangeSection", () => {
  it("harga sama dilabeli Ganti Paket tanpa opsi tagih selisih", () => {
    const { text, options } = render("SAME_PRICE");
    expect(text).toContain("Ganti Paket");
    expect(text).not.toContain("Upgrade");
    expect(options).toEqual(["NONE"]);
  });

  it("upgrade menawarkan tagih selisih prorate", () => {
    const { text, options } = render("UPGRADE");
    expect(text).toContain("Upgrade");
    expect(options).toEqual(["NONE", "PRORATE_CHARGE"]);
  });

  it("downgrade menawarkan kredit prorate", () => {
    const { text, options } = render("DOWNGRADE");
    expect(text).toContain("Downgrade");
    expect(options).toEqual(["NONE", "PRORATE_CREDIT"]);
  });
});
