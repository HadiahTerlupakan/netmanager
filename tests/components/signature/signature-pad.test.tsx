// @vitest-environment jsdom

import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignaturePad, {
  type SignaturePadHandle,
} from "@/components/signature/SignaturePad";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

function makeContext() {
  return {
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    strokeStyle: "",
  };
}

let context: ReturnType<typeof makeContext>;
let container: HTMLDivElement;
let root: Root;
let canvasWidth = 320;

beforeEach(() => {
  context = makeContext();
  canvasWidth = 320;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    PNG_DATA_URL,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => canvasWidth,
  );
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function getCanvas(): HTMLCanvasElement {
  const canvas = container.querySelector("canvas");
  if (!canvas) throw new Error("Kanvas tidak ditemukan");
  return canvas;
}

function drawStroke() {
  const canvas = getCanvas();
  act(() => {
    canvas.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 10,
        clientY: 10,
      }),
    );
    canvas.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 40,
        clientY: 30,
      }),
    );
    canvas.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  });
}

function renderPad(onChange = vi.fn(), insideForm = false) {
  const ref = createRef<SignaturePadHandle>();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const pad = <SignaturePad ref={ref} onChange={onChange} hint="Petunjuk" />;
  act(() => {
    root.render(insideForm ? <form onSubmit={onSubmit}>{pad}</form> : pad);
  });
  return { ref, onChange, onSubmit };
}

describe("SignaturePad", () => {
  it("kosong mengembalikan null dan berisi setelah digores", () => {
    const { ref, onChange } = renderPad();
    expect(ref.current?.toDataUrl()).toBeNull();

    drawStroke();

    expect(ref.current?.toDataUrl()).toBe(PNG_DATA_URL);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(getCanvas().getAttribute("aria-label")).toContain("sudah diisi");
  });

  it("tidak menghapus goresan saat hanya tinggi jendela berubah (keyboard HP)", () => {
    const { ref } = renderPad();
    drawStroke();
    const widthBefore = getCanvas().width;

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(getCanvas().width).toBe(widthBefore);
    expect(context.clearRect).not.toHaveBeenCalled();
    expect(ref.current?.toDataUrl()).toBe(PNG_DATA_URL);
  });

  it("menggambar ulang goresan saat lebar berubah", () => {
    const { ref } = renderPad();
    drawStroke();

    canvasWidth = 160;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(context.drawImage).toHaveBeenCalled();
    const [, , , width] = context.drawImage.mock.calls.at(-1) as number[];
    expect(width).toBeLessThan(320 * (window.devicePixelRatio || 1));
    expect(ref.current?.toDataUrl()).toBe(PNG_DATA_URL);
  });

  it("tombol Ulangi bertipe button, tidak mengirim form, dan mengosongkan kotak", () => {
    const { ref, onChange, onSubmit } = renderPad(vi.fn(), true);
    drawStroke();

    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Ulangi",
    );
    expect(button?.type).toBe("button");
    act(() => button?.click());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(ref.current?.toDataUrl()).toBeNull();
  });
});
