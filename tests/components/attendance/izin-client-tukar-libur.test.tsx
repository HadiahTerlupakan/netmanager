import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);
const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
);

const mockResponsiveTable = vi.fn((_props?: unknown) => null);
const mockButton = vi.fn((_props?: unknown) => null);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <T,>(initialValue: T): UseStateTuple<T> =>
      mockUseState(initialValue) as UseStateTuple<T>,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]): void => {
      mockUseEffect(effect, deps);
    },
    useCallback: <T extends (...args: unknown[]) => unknown>(
      fn: T,
      deps?: unknown[],
    ): T => mockUseCallback(fn, deps) as T,
  };
});

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/Button", () => ({
  Button: (props: unknown): null => {
    mockButton(props);
    return null;
  },
}));

vi.mock("@/components/ui/ResponsiveTable", () => ({
  ResponsiveTable: (props: unknown): null => {
    mockResponsiveTable(props);
    return null;
  },
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { IzinClient } from "@/app/admin/kehadiran/izin/IzinClient";

describe("IzinClient tukar libur form", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseState.mockImplementation((initialValue: unknown) => [
      initialValue,
      vi.fn(),
    ]);
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
    mockResponsiveTable.mockClear();
    mockButton.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("menyediakan opsi TUKAR_LIBUR dan field replacementDate pada form input manual", () => {
    mockUseState.mockImplementation((initialValue: unknown) => {
      if (initialValue === false && mockUseState.mock.calls.length === 8) {
        return [true, vi.fn()];
      }

      if (
        typeof initialValue === "object" &&
        initialValue !== null &&
        "userId" in initialValue &&
        "type" in initialValue
      ) {
        return [
          {
            ...initialValue,
            type: "TUKAR_LIBUR",
          },
          vi.fn(),
        ];
      }

      return [initialValue, vi.fn()];
    });

    const markup = renderToStaticMarkup(<IzinClient />);

    expect(markup).toContain('option value="TUKAR_LIBUR"');
    expect(markup).toContain("Tanggal Pengganti");
    expect(markup).toContain('type="date"');
  });
});
