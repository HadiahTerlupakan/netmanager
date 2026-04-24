// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConsoleWarning from "@/components/security/ConsoleWarning";

describe("ConsoleWarning", () => {
  let container: HTMLDivElement;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("emits self-xss notice as regular console messages instead of warnings", async () => {
    await act(async () => {
      createRoot(container).render(<ConsoleWarning />);
      await Promise.resolve();
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      1,
      "%cStop!",
      expect.stringContaining("font-size: 50px"),
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "Ini adalah fitur browser yang ditujukan untuk developer.",
      ),
      expect.stringContaining("line-height: 1.6"),
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      3,
      "%cPelajari lebih lanjut tentang Self-XSS: https://en.wikipedia.org/wiki/Self-XSS",
      expect.stringContaining("font-size: 14px"),
    );
  });
});
