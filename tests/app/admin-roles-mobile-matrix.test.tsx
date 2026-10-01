// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobilePermissionMatrix } from "@/app/admin/settings/roles/[id]/MobilePermissionMatrix";
import {
  IZIN_STANDAR_MOBILE_PER_PERSONA,
  type PersonaKaryawan,
} from "@/modules/roles/client";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));

/**
 * Matriks Mobile App mengikuti persona: izin yang dipakai di atas, sisanya
 * terlipat dengan peringatan; tombol izin standar hanya mengganti izin m_*.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
  persona: PersonaKaryawan;
  awal: string[];
  onUbah: (permissions: string[]) => void;
}

/** Pembungkus state agar perubahan izin terlihat di render berikutnya. */
function Harness({ persona, awal, onUbah }: HarnessProps) {
  const [permissions, setPermissions] = useState(awal);
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <MobilePermissionMatrix
      persona={persona}
      permissions={permissions}
      onPermissionsChange={(next) => {
        setPermissions(next);
        onUbah(next);
      }}
      expandedGroups={expanded}
      onToggleGroup={(key) =>
        setExpanded((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        )
      }
      onExpandGroups={(keys) => setExpanded((prev) => [...prev, ...keys])}
    />
  );
}

function cariTombol(teks: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(teks),
  );
}

describe("matriks Mobile App per persona", () => {
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

  it("memisahkan izin yang dipakai dan memperingatkan izin tak terlihat", async () => {
    await act(async () => {
      root.render(
        <Harness
          persona="SALES"
          awal={["m_dashboard:read", "m_work_order:read", "m_lembur:read"]}
          onUbah={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Dipakai di tampilan Sales");
    expect(container.textContent).toContain("Tidak tampil di HP Sales");
    expect(container.textContent).toContain("2 izin tidak akan terlihat di HP");
    expect(container.textContent).toContain(
      "Tampilan Sales tanpa izin Presurvei",
    );
    // Bagian terlipat tertutup: kelompok Network belum dirender.
    expect(container.textContent).not.toContain("network");

    await act(async () => {
      cariTombol("Tidak tampil di HP Sales")?.click();
    });
    expect(container.textContent).toContain("network");
  });

  it("teknisi tanpa Work Order mendapat peringatan Beranda kosong", async () => {
    await act(async () => {
      root.render(
        <Harness persona="TEKNISI" awal={["m_dashboard:read"]} onUbah={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain(
      "Tampilan Teknisi tanpa izin Work Order: Beranda teknisi akan kosong.",
    );
    expect(container.textContent).not.toContain("Tidak tampil di HP");
  });

  it("izin standar mengganti izin mobile setelah konfirmasi, izin web tetap", async () => {
    const onUbah = vi.fn();
    await act(async () => {
      root.render(
        <Harness
          persona="STAFF"
          awal={["pelanggan:read", "m_salary:read", "m_work_order:read"]}
          onUbah={onUbah}
        />,
      );
    });

    await act(async () => {
      cariTombol("Isi izin standar Staff")?.click();
    });
    expect(onUbah).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Isi izin standar Staff?");

    await act(async () => {
      cariTombol("Ganti izin mobile")?.click();
    });
    const hasil: string[] = onUbah.mock.calls[0][0];
    expect(hasil).toContain("pelanggan:read");
    expect(hasil).toContain("m_salary:read");
    expect(hasil).not.toContain("m_work_order:read");
    expect(hasil).toEqual(
      expect.arrayContaining([...IZIN_STANDAR_MOBILE_PER_PERSONA.STAFF]),
    );
    expect(container.textContent).not.toContain("tanpa izin");
  });

  it("mengganti persona menata ulang matriks tanpa mengubah centang", async () => {
    const onUbah = vi.fn();
    const awal = ["m_dashboard:read", "m_work_order:read"];
    await act(async () => {
      root.render(<Harness persona="TEKNISI" awal={awal} onUbah={onUbah} />);
    });
    expect(container.textContent).not.toContain("tidak akan terlihat");

    await act(async () => {
      root.render(<Harness persona="STAFF" awal={awal} onUbah={onUbah} />);
    });
    expect(container.textContent).toContain("Dipakai di tampilan Staff");
    expect(container.textContent).toContain("1 izin tidak akan terlihat di HP");
    expect(onUbah).not.toHaveBeenCalled();
  });
});
