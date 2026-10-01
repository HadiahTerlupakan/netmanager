// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children?: ReactNode; href?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/users/lib/useKandidatKepalaSales", () => ({
  useKandidatKepalaSales: () => ({ kandidat: [] as { id: string; nama: string }[], isLoading: false, isError: false }),
}));

import { RolePersonaHint } from "@/app/admin/users/components/RolePersonaHint";
import { StatusAndSalesSection } from "@/app/admin/users/components/UserFormSections";
import { personaRoleTerpilih, tautanUbahRole } from "@/app/admin/users/lib/personaRole";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROLES = [
  { id: "r-sales", name: "KEPALA SALES", persona: "SALES" },
  { id: "r-teknisi", name: "TEKNISI LAPANGAN", persona: "TEKNISI" },
  { id: "r-lama", name: "LAMA" },
];

describe("personaRoleTerpilih", () => {
  it("membaca persona role terpilih dan menurunkan isSales", () => {
    expect(personaRoleTerpilih(ROLES, "r-sales")).toEqual({
      roleId: "r-sales",
      namaRole: "KEPALA SALES",
      persona: "SALES",
      isSales: true,
    });
    expect(personaRoleTerpilih(ROLES, "r-teknisi")?.isSales).toBe(false);
  });

  it("role tanpa persona → STAFF; role tak dikenal/belum dipilih → null", () => {
    expect(personaRoleTerpilih(ROLES, "r-lama")?.persona).toBe("STAFF");
    expect(personaRoleTerpilih(ROLES, "")).toBeNull();
    expect(personaRoleTerpilih(ROLES, "tidak-ada")).toBeNull();
  });

  it("tautan ubah role menuju Hak Akses", () => {
    expect(tautanUbahRole("r-1")).toBe("/admin/pengaturan/hak-akses/r-1");
  });
});

describe("form user — sales mengikuti persona role", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  const formData = { isActive: true, canvasingTarget: 10, targetSchema: "REVENUE", kepalaSalesId: "" };

  it("tidak ada lagi saklar isSales; target canvassing untuk semua, kepala sales hanya Sales", async () => {
    await act(async () => {
      root.render(
        <StatusAndSalesSection
          formData={formData}
          isSales={false}
          handleChange={vi.fn()}
          userIdDiubah={null}
          kepalaSalesTersimpan={null}
        />,
      );
    });
    expect(container.querySelector('input[name="isSales"]')).toBeNull();
    // Teknisi yang ikut canvasing tetap perlu target & skema (pencairan bonus).
    expect(container.querySelector('input[name="canvasingTarget"]')).not.toBeNull();
    const opsiSkema = [...container.querySelectorAll('select[name="targetSchema"] option')].map((o) => (o as HTMLOptionElement).value);
    expect(opsiSkema).toEqual(["MONTHLY_RESET", "ACCUMULATED"]);
    expect(container.textContent).toContain("Kepala sales hanya untuk pengguna dengan role ber-tampilan Sales");

    await act(async () => {
      root.render(
        <StatusAndSalesSection
          formData={formData}
          isSales
          handleChange={vi.fn()}
          userIdDiubah={null}
          kepalaSalesTersimpan={null}
        />,
      );
    });
    expect(container.querySelector('input[name="canvasingTarget"]')).not.toBeNull();
    expect(container.querySelector('select[name="targetSchema"]')).not.toBeNull();
  });

  it("keterangan role menampilkan label persona dan tautan Hak Akses", async () => {
    await act(async () => {
      root.render(<RolePersonaHint personaRole={personaRoleTerpilih(ROLES, "r-sales")} />);
    });
    expect(container.textContent).toContain("Tampilan di HP: Sales (mengikuti role KEPALA SALES)");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/pengaturan/hak-akses/r-sales");
  });
});
