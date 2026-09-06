// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchableSelect from "@/components/common/SearchableSelect";

/**
 * Pemilihan ODP menampilkan ratusan entri (426 di produksi). `<select>` biasa
 * memanjang ke bawah tanpa cara menyaring, jadi komponen ini menyaring sambil
 * diketik. Nilainya tetap id opsi — bukan teks yang diketik — karena `odpId`
 * adalah foreign key ke node peta.
 */
let container: HTMLElement;
let root: Root;

const options = [
  { value: "odp-a", label: "ODP-BLJ-01" },
  { value: "odp-b", label: "ODP-FTM-07" },
  { value: "odp-c", label: "ODP-MRB-02" },
];

const render = async (ui: React.ReactElement) => {
  await act(async () => {
    root = createRoot(container);
    root.render(ui);
  });
};

const input = () => container.querySelector("input") as HTMLInputElement;
const optionButtons = () =>
  [...container.querySelectorAll('[role="option"]')] as HTMLButtonElement[];

const type = async (text: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input(), text);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SearchableSelect", () => {
  it("menampilkan label pilihan saat tertutup, bukan id-nya", async () => {
    await render(
      <SearchableSelect value="odp-b" onChange={() => {}} options={options} />,
    );

    expect(input().value).toBe("ODP-FTM-07");
  });

  it("menyaring opsi sesuai ketikan", async () => {
    await render(
      <SearchableSelect value="" onChange={() => {}} options={options} />,
    );

    await type("mrb");

    expect(optionButtons().map((b) => b.textContent)).toEqual(["ODP-MRB-02"]);
  });

  // Inti kebutuhannya: id yang dikirim, bukan teks yang diketik.
  it("mengirim id opsi saat dipilih", async () => {
    const onChange = vi.fn();
    await render(
      <SearchableSelect value="" onChange={onChange} options={options} />,
    );

    await type("ftm");
    await act(async () => optionButtons()[0]?.click());

    expect(onChange).toHaveBeenCalledWith("odp-b");
  });

  it("memberi tahu saat tidak ada yang cocok", async () => {
    await render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        options={options}
        noResultLabel="Tidak ada ODP yang cocok"
      />,
    );

    await type("zzz");

    expect(optionButtons()).toHaveLength(0);
    expect(container.textContent).toContain("Tidak ada ODP yang cocok");
  });

  // Ratusan opsi tidak boleh dirender sekaligus setiap ketikan.
  it("memotong daftar panjang dan menyebutkan sisanya", async () => {
    const many = Array.from({ length: 426 }, (_, i) => ({
      value: `odp-${i}`,
      label: `ODP-${String(i).padStart(3, "0")}`,
    }));

    await render(
      <SearchableSelect value="" onChange={() => {}} options={many} />,
    );
    await type("ODP");

    expect(optionButtons()).toHaveLength(50);
    expect(container.textContent).toContain("376 lainnya");
  });

  it("mengosongkan pilihan lewat tombol hapus", async () => {
    const onChange = vi.fn();
    await render(
      <SearchableSelect value="odp-a" onChange={onChange} options={options} />,
    );

    const clearButton = container.querySelector(
      '[aria-label="Kosongkan pilihan"]',
    ) as HTMLButtonElement;
    await act(async () => clearButton.click());

    expect(onChange).toHaveBeenCalledWith("");
  });
});
