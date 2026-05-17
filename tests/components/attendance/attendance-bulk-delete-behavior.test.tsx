import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];
type AttendanceRow = {
  id: string;
  user: { name: string | null; email: string };
};
type SelectionColumn = {
  key: string;
  header: ReactElement<{ disabled?: boolean }>;
  render: (item: AttendanceRow) => ReactElement<{ disabled?: boolean }>;
};

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);
const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
);

let hasDeletePermission = true;

const mockResponsiveTable = vi.fn((_props?: unknown) => null);

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
    hasPermission: (permission: string) => {
      if (permission === "attendance:delete") {
        return hasDeletePermission;
      }

      return true;
    },
  }),
}));

const mockShowToast = vi.fn();
type MockFetchResponse =
  | {
      data: {
        sites: { id: string; name: string }[];
        departments: { id: string; name: string }[];
      };
    }
  | {
      data: [];
      pagination: { totalPages: number; total: number };
      summary?: Record<string, number>;
    }
  | {
      data: {
        deletedCount: number;
        skippedCount: number;
        deletedIds: string[];
        requestedCount: number;
      };
    };

const mockFetchWithHandling = vi.fn(
  async (_url?: unknown, _options?: unknown): Promise<MockFetchResponse> => ({
    data: [],
    pagination: { totalPages: 1, total: 0 },
  }),
);
const mockButton = vi.fn((_props?: unknown) => null);

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(value: T) => value,
}));

const mockUseApi = vi.fn(() => ({
  data: undefined as unknown,
  error: undefined as unknown,
  isLoading: false,
  mutate: vi.fn(),
}));

const mockUseQuery = vi.fn(() => ({
  data: undefined as unknown,
  error: null,
  isPending: false,
}));

const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockUseQuery(),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (...args: unknown[]) => mockUseApi(...(args as [])),
  apiFetcher: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/utils/fetch-wrapper", () => ({
  fetchWithHandling: (url?: unknown, options?: unknown) =>
    mockFetchWithHandling(url, options),
  isFetchError: vi.fn(() => false),
  formatErrorMessage: vi.fn(() => "error"),
}));

vi.mock("next/image", () => ({
  default: (): null => null,
}));

vi.mock("@/components/ui/ResponsiveTable", () => ({
  ResponsiveTable: (props: unknown): null => {
    mockResponsiveTable(props);
    return null;
  },
}));

vi.mock("@/components/ui/Button", () => ({
  Button: (props: unknown): null => {
    mockButton(props);
    return null;
  },
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: (): null => null,
  ModalFooter: (): null => null,
}));

import { ClientComponent } from "@/app/admin/attendance/AttendanceClient";

describe("AttendanceClient bulk delete behavior", () => {
  beforeEach(() => {
    hasDeletePermission = true;
    mockUseState.mockReset();
    mockUseState.mockImplementation((initialValue: unknown) => [
      initialValue,
      vi.fn(),
    ]);
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
    mockResponsiveTable.mockClear();
    mockShowToast.mockClear();
    mockFetchWithHandling.mockReset();
    mockFetchWithHandling.mockImplementation(
      async (
        _url?: unknown,
        _options?: unknown,
      ): Promise<MockFetchResponse> => ({
        data: [],
        pagination: { totalPages: 1, total: 0 },
      }),
    );
    mockButton.mockClear();
    vi.stubGlobal("window", { confirm: vi.fn(() => true) });
  });

  it("menyembunyikan kontrol bulk delete ketika user tidak memiliki permission delete", () => {
    hasDeletePermission = false;

    renderToStaticMarkup(<ClientComponent />);

    const lastResponsiveTableCall = mockResponsiveTable.mock.calls.at(-1);

    if (!lastResponsiveTableCall) {
      throw new Error("ResponsiveTable harus dipanggil");
    }

    const responsiveTableProps = lastResponsiveTableCall[0] as {
      columns: Array<{ key: string }>;
    };

    const hasSelectionColumn = responsiveTableProps.columns.some(
      (column) => column.key === "selection",
    );

    expect(hasSelectionColumn).toBe(false);
  });

  it("menonaktifkan checkbox seleksi ketika bulk delete sedang berjalan", () => {
    let falseStateCallCount = 0;
    mockUseState.mockImplementation((initialValue: unknown) => {
      // isBulkDeleting adalah useState(false) ke-1 di komponen
      if (initialValue === false) {
        falseStateCallCount += 1;
        if (falseStateCallCount === 1) {
          return [true, vi.fn()];
        }
      }
      return [initialValue, vi.fn()];
    });

    renderToStaticMarkup(<ClientComponent />);

    const lastResponsiveTableCall = mockResponsiveTable.mock.calls.at(-1);

    if (!lastResponsiveTableCall) {
      throw new Error("ResponsiveTable harus dipanggil");
    }

    const responsiveTableProps = lastResponsiveTableCall[0] as {
      columns: SelectionColumn[];
    };

    const selectionColumn = responsiveTableProps.columns.find(
      (column) => column.key === "selection",
    );

    if (!selectionColumn) {
      throw new Error(
        "selection column harus ada untuk user dengan permission delete",
      );
    }

    const rowCheckbox = selectionColumn.render({
      id: "att-1",
      user: { name: "User", email: "user@example.com" },
    });

    expect(selectionColumn.header.props.disabled).toBe(true);
    expect(rowCheckbox.props.disabled).toBe(true);
  });

  it("mengabaikan page size invalid agar tidak menyimpan NaN", () => {
    const setPageSize = vi.fn();

    mockUseState.mockImplementation((initialValue: unknown) => {
      if (initialValue === 10) {
        return [initialValue, setPageSize];
      }

      return [initialValue, vi.fn()];
    });

    renderToStaticMarkup(<ClientComponent />);

    const lastResponsiveTableCall = mockResponsiveTable.mock.calls.at(-1);

    if (!lastResponsiveTableCall) {
      throw new Error("ResponsiveTable harus dipanggil");
    }

    const responsiveTableProps = lastResponsiveTableCall[0] as {
      onItemsPerPageChange: (value: string) => void;
    };

    responsiveTableProps.onItemsPerPageChange("invalid-number");

    expect(setPageSize).not.toHaveBeenCalled();
  });

  it("menampilkan ringkasan hapus parsial setelah bulk delete", async () => {
    const setSelectedAttendanceIds = vi.fn();

    mockUseState.mockImplementation((initialValue: unknown) => {
      // selectedAttendanceIds adalah satu-satunya useState<string[]>([]) di komponen
      if (Array.isArray(initialValue) && initialValue.length === 0) {
        return [["att-1", "att-2"], setSelectedAttendanceIds];
      }
      return [initialValue, vi.fn()];
    });

    mockFetchWithHandling.mockImplementation(
      async (url?: unknown, _options?: unknown): Promise<MockFetchResponse> => {
        if (url === "/api/admin/options") {
          return {
            data: {
              sites: [],
              departments: [],
            },
          };
        }

        if (
          typeof url === "string" &&
          url.startsWith("/api/admin/attendance?")
        ) {
          return {
            data: [],
            pagination: { totalPages: 1, total: 0 },
            summary: {},
          };
        }

        return {
          data: {
            deletedCount: 1,
            skippedCount: 1,
            deletedIds: ["att-1"],
            requestedCount: 2,
          },
        };
      },
    );

    renderToStaticMarkup(<ClientComponent />);

    const bulkDeleteButtonCall = mockButton.mock.calls.find((call) => {
      const props = call[0] as {
        children?: unknown;
      };

      return String(props.children).includes("Hapus Terpilih");
    });

    if (!bulkDeleteButtonCall) {
      throw new Error("Button bulk delete harus dipanggil");
    }

    const bulkDeleteButtonProps = bulkDeleteButtonCall[0] as {
      onClick: () => Promise<void>;
    };

    await bulkDeleteButtonProps.onClick();

    expect(mockShowToast).toHaveBeenCalledWith(
      "success",
      "1 data absensi dihapus, 1 data dilewati",
    );
    expect(setSelectedAttendanceIds).toHaveBeenCalledWith([]);
  });
});
