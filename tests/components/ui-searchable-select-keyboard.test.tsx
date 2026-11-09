// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchableSelect } from "@/components/ui/SearchableSelect";

/**
 * Trigger bisa dibuka lewat keyboard (Enter/Spasi). Tombol Kosongkan berada di
 * dalam trigger, jadi Enter pada tombol itu tidak boleh ikut membuka daftar.
 */
let container: HTMLElement;
let root: Root;

const options = [
  { value: "barang-a", label: "Kabel FO" },
  { value: "barang-b", label: "Konektor SC" },
];

const pressKey = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });

const renderSelect = async (onChange = vi.fn()) => {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <SearchableSelect
        options={options}
        value="barang-a"
        onChange={onChange}
        ariaLabel="Barang pengganti"
      />,
    );
  });
  return onChange;
};

const trigger = () => container.querySelector('[role="button"]') as HTMLElement;
const isOpen = () => trigger().getAttribute("aria-expanded") === "true";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SearchableSelect (ui) keyboard", () => {
  it("membuka daftar dengan Enter pada trigger", async () => {
    await renderSelect();
    await pressKey(trigger(), "Enter");
    expect(isOpen()).toBe(true);
  });

  it("Enter pada tombol Kosongkan tidak membuka daftar", async () => {
    await renderSelect();
    const clearButton = container.querySelector(
      'button[aria-label="Kosongkan Barang pengganti"]',
    ) as HTMLButtonElement;
    expect(clearButton).not.toBeNull();
    await pressKey(clearButton, "Enter");
    expect(isOpen()).toBe(false);
  });
});
