// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaBadge } from "@/app/admin/settings/roles/PersonaBadge";
import { PersonaSelector } from "@/app/admin/settings/roles/[id]/PersonaSelector";

/**
 * Kabel persona di form & daftar role admin: tiap opsi tampil dengan label
 * dan penjelasannya, pilihan memanggil `onChange` dengan nilai enum (bukan
 * label), dan badge menampilkan label Indonesia.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("persona role admin", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
  });

  it("PersonaSelector menampilkan kelima persona beserta penjelasannya", async () => {
    await act(async () => {
      root.render(
        <PersonaSelector value="STAFF" onChange={vi.fn()} hasMobileAccess />,
      );
    });

    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"][name="persona"]',
    );
    expect([...radios].map((radio) => radio.value)).toEqual([
      "STAFF",
      "TEKNISI",
      "SALES",
      "FINANCE",
      "DIREKTUR",
    ]);
    expect(container.textContent).toContain(
      "Tampilan aplikasi mobile (persona)",
    );
    expect(container.textContent).toContain("Work order");
    expect(container.textContent).toContain("Presurvei");
    expect(container.textContent).toContain(
      "Sementara memakai tampilan Staff",
    );
    expect(
      container.querySelector<HTMLInputElement>('input[value="STAFF"]')
        ?.checked,
    ).toBe(true);
    expect(container.textContent).not.toContain(
      "Hanya berlaku bila Akses Mobile App",
    );
  });

  it("memilih opsi mengirim nilai enum ke onChange", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <PersonaSelector
          value="STAFF"
          onChange={onChange}
          hasMobileAccess={false}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLInputElement>('input[value="SALES"]')
        ?.click();
    });

    expect(onChange).toHaveBeenCalledWith("SALES");
    expect(container.textContent).toContain(
      "Hanya berlaku bila Akses Mobile App diaktifkan.",
    );
  });

  it("menyarankan persona Sales bila izin menandai kepala sales", async () => {
    const SARAN = "Role ini bisa menugaskan rencana kunjungan (kepala sales).";
    await act(async () => {
      root.render(
        <PersonaSelector value="STAFF" onChange={vi.fn()} hasMobileAccess isKepalaSales />,
      );
    });
    expect(container.textContent).toContain(SARAN);
    expect(container.textContent).toContain("Biasanya dipasangkan dengan tampilan Sales.");

    await act(async () => {
      root.render(
        <PersonaSelector value="SALES" onChange={vi.fn()} hasMobileAccess isKepalaSales />,
      );
    });
    expect(container.textContent).not.toContain(SARAN);

    await act(async () => {
      root.render(<PersonaSelector value="STAFF" onChange={vi.fn()} hasMobileAccess />);
    });
    expect(container.textContent).not.toContain(SARAN);
  });

  it("penjelasan persona Sales menyebut pengguna otomatis tampil sebagai sales", async () => {
    await act(async () => {
      root.render(<PersonaSelector value="STAFF" onChange={vi.fn()} hasMobileAccess />);
    });
    expect(container.textContent).toContain("otomatis tampil sebagai sales");
  });

  it("PersonaBadge menampilkan label Indonesia", async () => {
    await act(async () => {
      root.render(<PersonaBadge persona="DIREKTUR" />);
    });
    expect(container.textContent).toBe("Direktur");
  });
});
