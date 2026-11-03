// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  mutate: vi.fn(),
  fetchWithHandling: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: mocks.useApi }));
vi.mock("@/lib/utils/fetch-wrapper", () => ({
  fetchWithHandling: mocks.fetchWithHandling,
  formatErrorMessage: () => "galat",
  isFetchError: () => false,
}));
vi.mock("react-hot-toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import {
  ComplianceSettingToggle,
  SettlementApproverSettingToggle,
} from "@/app/admin/resellers/ComplianceSettingToggle";
import {
  PartnershipStatusCell,
  PksStatusBadge,
} from "@/app/admin/resellers/ResellerComplianceBadges";
import { ResellerModal } from "@/app/admin/resellers/ResellerModal";
import {
  toResellerForm,
  type Reseller,
  type ResellerForm,
} from "@/app/admin/resellers/types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SAVED_RESELLER: Reseller = {
  id: "r1",
  code: "R1",
  name: "Reseller Satu",
  email: null,
  phone: null,
  address: null,
  status: "ACTIVE",
  notes: null,
  legalName: "PT Mitra",
  nib: "1234567890123",
  kbliCode: "61994",
  standardCertificateNumber: "SS-001",
  brandName: null,
  licenseVerifiedAt: "2026-11-01T00:00:00.000Z",
  statusReason: null,
  statusChangedAt: null,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

/** Modal dengan state form nyata; form terakhir dilaporkan ke `onFormChange`. */
function StatefulModal({
  saved,
  onFormChange,
}: {
  readonly saved: Reseller;
  readonly onFormChange: (form: ResellerForm) => void;
}) {
  const savedForm = toResellerForm(saved);
  const [form, setForm] = useState(savedForm);
  return (
    <ResellerModal
      isOpen
      isEditing
      saving={false}
      form={form}
      savedForm={savedForm}
      onClose={() => undefined}
      onSave={() => undefined}
      onChange={(next) => {
        setForm(next);
        onFormChange(next);
      }}
    />
  );
}

function renderModal(saved: Reseller = SAVED_RESELLER) {
  let latest = toResellerForm(saved);
  act(() =>
    root.render(
      <StatefulModal
        saved={saved}
        onFormChange={(form) => {
          latest = form;
        }}
      />,
    ),
  );
  return () => latest;
}

function query<T extends Element>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}

/** Ketik ke input terkontrol React (setter native + event input). */
function typeInto(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element) as object;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function selectStatus(value: string) {
  const select = query<HTMLSelectElement>(
    'select[aria-label="Status kemitraan"]',
  );
  act(() => {
    if (!select) throw new Error("select status tidak ada");
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const nibInput = () =>
  query<HTMLInputElement>('input[placeholder="NIB (13 digit)"]');
const reasonInput = () =>
  query<HTMLTextAreaElement>('textarea[aria-label="Alasan perubahan status"]');

describe("ResellerModal — verifikasi izin", () => {
  it("mengubah NIB melepas centang verifikasi", () => {
    const latestForm = renderModal();
    const input = nibInput();
    if (!input) throw new Error("input NIB tidak ada");

    typeInto(input, "9999999999999");

    expect(latestForm().licenseVerified).toBe(false);
  });

  it("mengembalikan NIB ke nilai tersimpan memulihkan verifikasi", () => {
    const latestForm = renderModal();
    const input = nibInput();
    if (!input) throw new Error("input NIB tidak ada");

    typeInto(input, "9999999999999");
    typeInto(input, "1234567890123");

    expect(latestForm().licenseVerified).toBe(true);
  });
});

describe("ResellerModal — alasan status", () => {
  it("status ACTIVE tersimpan tanpa alasan: kolom alasan tidak tampil", () => {
    renderModal();
    expect(reasonInput()).toBeNull();
  });

  it("memilih SUSPENDED memunculkan kolom alasan wajib", () => {
    renderModal();

    selectStatus("SUSPENDED");

    expect(reasonInput()?.placeholder).toContain("(wajib)");
  });

  it("memilih INACTIVE tetap memunculkan kolom alasan (opsional)", () => {
    renderModal();

    selectStatus("INACTIVE");

    expect(reasonInput()?.placeholder).toBe("Alasan perubahan status");
  });

  it("kolom alasan tidak hilang saat isinya dihapus", () => {
    const latestForm = renderModal({
      ...SAVED_RESELLER,
      status: "SUSPENDED",
      statusReason: "Tunggakan",
    });
    const textarea = reasonInput();
    if (!textarea) throw new Error("textarea alasan tidak ada");

    typeInto(textarea, "");

    expect(latestForm().statusReason).toBe("");
    expect(reasonInput()).not.toBeNull();
  });

  it("mengaktifkan kembali reseller TERMINATED mewajibkan alasan baru", () => {
    const latestForm = renderModal({
      ...SAVED_RESELLER,
      status: "TERMINATED",
      statusReason: "Pelanggaran PKS",
    });

    selectStatus("ACTIVE");

    expect(latestForm().statusReason).toBe("");
    expect(reasonInput()?.placeholder).toContain("(wajib)");
  });

  it("kembali ke status tersimpan memulihkan alasan tersimpan", () => {
    const latestForm = renderModal({
      ...SAVED_RESELLER,
      status: "SUSPENDED",
      statusReason: "Tunggakan",
    });

    selectStatus("TERMINATED");
    selectStatus("SUSPENDED");

    expect(latestForm().statusReason).toBe("Tunggakan");
  });

  it("status non-ACTIVE menampilkan peringatan komisi berhenti", () => {
    renderModal();

    selectStatus("INACTIVE");

    expect(document.body.textContent).toContain("tidak menghasilkan komisi");
  });
});

describe("Badge kepatuhan reseller", () => {
  function renderBadges(reseller: Reseller) {
    act(() =>
      root.render(
        <>
          <PartnershipStatusCell reseller={reseller} />
          <PksStatusBadge reseller={reseller} />
        </>,
      ),
    );
    return container.textContent ?? "";
  }

  it("reseller tidak patuh mendapat badge 'Belum patuh'", () => {
    const text = renderBadges({
      ...SAVED_RESELLER,
      compliance: {
        isCompliant: false,
        issueLabels: ["belum ada PKS aktif di modul Legal"],
        pks: {
          status: "NONE",
          documentId: null,
          startDate: null,
          endDate: null,
          daysLeft: null,
        },
      },
    });

    expect(text).toContain("Belum patuh");
    expect(text).toContain("Belum ada PKS");
  });

  it("reseller patuh tidak mendapat badge peringatan", () => {
    const text = renderBadges({
      ...SAVED_RESELLER,
      compliance: {
        isCompliant: true,
        issueLabels: [],
        pks: {
          status: "ACTIVE",
          documentId: "doc-1",
          startDate: null,
          endDate: null,
          daysLeft: null,
        },
      },
    });

    expect(text).not.toContain("Belum patuh");
    expect(text).toContain("PKS aktif");
  });

  it("PKS yang belum mulai tampil 'PKS belum berlaku' dengan tanggal mulai", () => {
    const text = renderBadges({
      ...SAVED_RESELLER,
      compliance: {
        isCompliant: false,
        issueLabels: ["PKS sudah ada tetapi belum mulai berlaku"],
        pks: {
          status: "PENDING",
          documentId: "doc-2",
          startDate: "2026-12-01T00:00:00.000Z",
          endDate: null,
          daysLeft: null,
        },
      },
    });

    expect(text).toContain("PKS belum berlaku");
    expect(text).toContain("2026");
    expect(text).not.toContain("Belum ada PKS");
  });
});

describe("ComplianceSettingToggle", () => {
  function renderToggle(canUpdate: boolean) {
    mocks.useApi.mockReturnValue({
      data: { isComplianceRequired: false },
      mutate: mocks.mutate,
    });
    act(() => root.render(<ComplianceSettingToggle canUpdate={canUpdate} />));
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!checkbox) throw new Error("checkbox tidak ada");
    return checkbox;
  }

  it("mengaktifkan sakelar mengirim PUT dengan body yang benar", async () => {
    mocks.fetchWithHandling.mockResolvedValueOnce({});
    const checkbox = renderToggle(true);

    await act(async () => {
      checkbox.click();
    });

    expect(mocks.fetchWithHandling).toHaveBeenCalledWith(
      "/api/admin/resellers/compliance-setting",
      { method: "PUT", body: JSON.stringify({ isComplianceRequired: true }) },
    );
    expect(mocks.mutate).toHaveBeenCalled();
  });

  it("tanpa izin pengaturan sakelar dinonaktifkan", () => {
    expect(renderToggle(false).disabled).toBe(true);
  });
});

describe("SettlementApproverSettingToggle", () => {
  function renderToggle(isEnabled: boolean) {
    mocks.useApi.mockReturnValue({
      data: {
        isComplianceRequired: true,
        isSettlementSeparateApproverRequired: isEnabled,
      },
      mutate: mocks.mutate,
    });
    act(() => root.render(<SettlementApproverSettingToggle canUpdate />));
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!checkbox) throw new Error("checkbox tidak ada");
    return checkbox;
  }

  it("membaca sakelarnya sendiri, bukan sakelar kepatuhan", () => {
    expect(renderToggle(false).checked).toBe(false);
    expect(container.textContent).toContain(
      "Pisahkan penyetuju dan pembayar settlement",
    );
  });

  it("mengubah hanya sakelar pemisahan tugas lewat endpoint yang sama", async () => {
    mocks.fetchWithHandling.mockResolvedValueOnce({});
    const checkbox = renderToggle(false);

    await act(async () => {
      checkbox.click();
    });

    expect(mocks.fetchWithHandling).toHaveBeenCalledWith(
      "/api/admin/resellers/compliance-setting",
      {
        method: "PUT",
        body: JSON.stringify({ isSettlementSeparateApproverRequired: true }),
      },
    );
    expect(mocks.mutate).toHaveBeenCalled();
  });
});
