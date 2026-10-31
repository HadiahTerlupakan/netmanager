// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExpiryCountdown } from "@/app/(customer)/tagihan/useExpiryCountdown";
import "../helpers/portal-dom";

const NOW = new Date("2026-10-31T10:00:00.000Z");

function Countdown(props: { expiresAt: string; onExpire: () => void }) {
  return <span>{useExpiryCountdown(props.expiresAt, props.onExpire)}</span>;
}

/**
 * onExpire dulu fungsi inline baru tiap render, sehingga efek hitung mundur
 * berjalan ulang di setiap render dan, setelah kedaluwarsa, memuat ulang
 * tagihan sekitar 38 kali per detik.
 */
describe("useExpiryCountdown", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  function renderCountdown(expiresAt: string, onExpire: () => void) {
    act(() =>
      root.render(<Countdown expiresAt={expiresAt} onExpire={onExpire} />),
    );
  }

  function secondsFromNow(seconds: number) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  it("menghitung mundur lalu memanggil onExpire sekali", () => {
    const onExpire = vi.fn();
    renderCountdown(secondsFromNow(3), onExpire);
    expect(container.textContent).toBe("00:00:03");

    act(() => vi.advanceTimersByTime(1000));
    expect(container.textContent).toBe("00:00:02");

    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("Kedaluwarsa");
  });

  it("callback baru di setiap render tidak memicu onExpire lagi", () => {
    const expiresAt = secondsFromNow(-5);
    const calls: number[] = [];
    for (let render = 0; render < 20; render += 1) {
      renderCountdown(expiresAt, () => calls.push(render));
      act(() => vi.advanceTimersByTime(500));
    }

    expect(calls).toHaveLength(1);
  });

  it("checkout baru dengan batas waktu lain dihitung ulang", () => {
    const onExpire = vi.fn();
    renderCountdown(secondsFromNow(-1), onExpire);
    expect(onExpire).toHaveBeenCalledTimes(1);

    renderCountdown(secondsFromNow(2), onExpire);
    expect(container.textContent).toBe("00:00:02");
    act(() => vi.advanceTimersByTime(3000));

    expect(onExpire).toHaveBeenCalledTimes(2);
  });
});
