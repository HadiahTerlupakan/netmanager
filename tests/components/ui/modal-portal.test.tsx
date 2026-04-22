// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { Modal, ModalFooter } from "@/components/ui/Modal";

describe("Modal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders dialog outside parent stacking context using portal", async () => {
    const host = document.createElement("div");
    host.setAttribute("data-host", "modal-parent");
    document.body.appendChild(host);

    await act(async () => {
      createRoot(host).render(
        <div
          data-testid="stacking-parent"
          style={{ transform: "translateZ(0)" }}
        >
          <Modal isOpen={true} onClose={() => undefined} title="Test Modal">
            <div>Isi modal</div>
          </Modal>
        </div>,
      );
      await Promise.resolve();
    });

    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog).toBeTruthy();
    expect(host.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("renders modal header without sticky positioning", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      createRoot(host).render(
        <Modal isOpen={true} onClose={() => undefined} title="Test Modal">
          <div>Isi modal</div>
        </Modal>,
      );
      await Promise.resolve();
    });

    const title = document.getElementById("modal-title");
    const header = title?.closest("div.flex.items-start.justify-between");

    expect(header).toBeTruthy();
    expect(header?.className).not.toContain("sticky");
    expect(header?.className).not.toContain("top-0");
  });

  it("renders mobile-safe scroll container and dynamic viewport height", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      createRoot(host).render(
        <Modal isOpen={true} onClose={() => undefined} title="Test Modal">
          <div>Isi modal</div>
        </Modal>,
      );
      await Promise.resolve();
    });

    const dialog = document.querySelector('[role="dialog"]');
    const panel = dialog?.firstElementChild as HTMLElement | null;

    expect(dialog).toBeTruthy();
    expect(dialog?.className).toContain("overflow-y-auto");
    expect(panel).toBeTruthy();
    expect(panel?.className).toContain("max-h-[calc(100dvh-1.5rem)]");
    expect(panel?.className).toContain("sm:max-h-[90dvh]");
  });

  it("renders modal footer without sticky positioning", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      createRoot(host).render(
        <Modal
          isOpen={true}
          onClose={() => undefined}
          title="Test Modal"
          padding={false}
        >
          <div>Isi modal</div>
          <ModalFooter>
            <button type="button">Batal</button>
            <button type="button">Simpan</button>
          </ModalFooter>
        </Modal>,
      );
      await Promise.resolve();
    });

    const footer = document.querySelector("div.border-t.border-gray-200");

    expect(footer).toBeTruthy();
    expect(footer?.className).not.toContain("sticky");
    expect(footer?.className).not.toContain("bottom-0");
  });
});
