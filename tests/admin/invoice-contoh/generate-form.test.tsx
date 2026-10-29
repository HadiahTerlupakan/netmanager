// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/PetaUniversal", () => ({
  PetaUniversal: ({
    onKlik,
    children,
  }: {
    onKlik: (lat: number, lng: number) => void;
    children?: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        data-testid="peta"
        onClick={() => onKlik(-6.5, 107.1)}
      >
        peta
      </button>
      {children}
    </div>
  ),
}));
vi.mock("@/components/map/PenandaUniversal", () => ({
  PenandaUniversal: (): null => null,
}));

import { GenerateForm } from "@/app/admin/finance/invoice-contoh/GenerateForm";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LIMITS = { maxCustomers: 500, maxMonths: 12, maxPdfs: 2000 };
const STREETS = Array.from({ length: 6 }, (_, i) => ({ name: `Jalan ${i}` }));

let container: HTMLDivElement;
let root: Root;

function setValue(selector: string, value: string) {
  const element = container.querySelector(selector) as
    | HTMLInputElement
    | HTMLSelectElement;
  const proto =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

const submitButton = () =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith("Generate"),
  ) as HTMLButtonElement;
const text = () => container.textContent ?? "";

async function render(props: Partial<Parameters<typeof GenerateForm>[0]> = {}) {
  const fetchStreets = vi.fn(async () => ({
    ok: true as const,
    streets: STREETS,
  }));
  const onSubmit = vi.fn(async () => {});
  await act(async () => {
    root.render(
      <GenerateForm
        mitras={[{ id: "m1", name: "Mitra Selawangi" }]}
        issuer={{ name: "PT Contoh", address: "", phone: "" }}
        limits={LIMITS}
        currentMonth="2026-10"
        fetchStreets={fetchStreets}
        onSubmit={onSubmit}
        {...props}
      />,
    );
  });
  return { fetchStreets, onSubmit };
}

async function fillValidForm() {
  await act(async () => {
    setValue('select[name="mitraId"]', "m1");
    setValue('input[name="package-0-name"]', "Home 10");
    setValue('input[name="package-0-price"]', "150000");
    setValue('input[name="customerCount"]', "50");
    setValue('input[name="fromMonth"]', "2026-08");
    setValue('input[name="toMonth"]', "2026-10");
  });
  await act(async () => {
    (
      container.querySelector('[data-testid="peta"]') as HTMLButtonElement
    ).click();
  });
}

describe("GenerateForm", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("stays disabled until mitra, package, map point and streets are set", async () => {
    await render();
    expect(submitButton().disabled).toBe(true);

    expect(text()).toContain("Pilih mitra");
    await fillValidForm();

    expect(text()).toContain("6 jalan bernama ditemukan");
    expect(text()).not.toContain("Lengkapi dulu");
    expect(submitButton().disabled).toBe(false);
  });

  it("shows the PDF count live", async () => {
    await render();
    await fillValidForm();
    expect(container.querySelector('[data-summary="pdf"]')?.textContent).toBe(
      "150",
    );
  });

  it("blocks a generate above the PDF limit and says why", async () => {
    await render({ limits: { ...LIMITS, maxPdfs: 100 } });
    await fillValidForm();
    expect(text()).toContain("melewati batas 100");
    expect(submitButton().disabled).toBe(true);
  });

  it("lets the admin fill an empty issuer", async () => {
    await render({ issuer: { name: "", address: "", phone: "" } });
    await fillValidForm();
    expect(submitButton().disabled).toBe(true);

    await act(async () => setValue('input[name="issuerName"]', "PT Baru"));
    expect(submitButton().disabled).toBe(false);
  });

  it("shows the OpenStreetMap error and keeps the button disabled", async () => {
    await render({
      fetchStreets: vi.fn(async () => ({
        ok: false as const,
        message: "OpenStreetMap sedang sibuk",
      })),
    });
    await fillValidForm();
    expect(text()).toContain("OpenStreetMap sedang sibuk");
    expect(submitButton().disabled).toBe(true);
  });

  it("submits a package's add-ons and skips an unfilled one", async () => {
    const { onSubmit } = await render();
    await fillValidForm();
    const addAddon = () =>
      (
        [...container.querySelectorAll("button")].find(
          (b) => b.textContent === "Tambah add-on",
        ) as HTMLButtonElement
      ).click();
    await act(async () => addAddon());
    await act(async () => addAddon());
    await act(async () => {
      setValue('input[name="package-0-addon-0-name"]', "Sewa modem");
      setValue('input[name="package-0-addon-0-price"]', "25000");
    });
    await act(async () => submitButton().click());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        packages: [
          {
            name: "Home 10",
            speed: "",
            price: 150000,
            addons: [{ name: "Sewa modem", price: 25000 }],
          },
        ],
      }),
    );
  });

  it("submits the form with the streets found", async () => {
    const { onSubmit } = await render();
    await fillValidForm();
    await act(async () => submitButton().click());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mitraId: "m1",
        mitraName: "Mitra Selawangi",
        customerCount: 50,
        fromMonth: "2026-08",
        toMonth: "2026-10",
        center: { lat: -6.5, lng: 107.1 },
        packages: [{ name: "Home 10", speed: "", price: 150000 }],
        streets: STREETS,
      }),
    );
  });
});
