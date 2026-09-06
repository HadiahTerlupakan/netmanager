// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useInvalidatePlanningRelated } from "@/lib/hooks/useInvalidate";

/**
 * Regresi: menghapus rencana memunculkan "Gagal memuat detail planning".
 *
 * Halaman detail berlangganan `/api/planning/<id>`. Saat tombol Hapus ditekan,
 * `handleDelete` memanggil invalidasi berbasis awalan lalu `router.push`.
 * Navigasi tidak melepas komponen secara sinkron, jadi query detail masih
 * aktif — dan `invalidateQueries` secara default me-refetch query aktif.
 * Refetch itu menembak rencana yang baru saja dihapus, yang kini benar-benar
 * membalas 404 (repository memfilter `deletedAt`), sehingga `onError` di
 * halaman detail menembakkan toast kegagalan tepat setelah toast sukses.
 *
 * Daftar, dashboard, dan kanban tetap harus di-refetch — yang tidak boleh
 * hanyalah resource yang barusan dihapus.
 */

const DETAIL_KEY = "/api/planning/plan-1";
const LIST_KEY = "/api/planning?page=1&limit=20";

let container: HTMLElement;
let root: Root;

const fetchSpy = vi.fn<(key: string) => Promise<string>>(async (key) => key);

/** Menahan satu query aktif per key, meniru halaman yang sedang terbuka. */
function ActiveQuery({ queryKey }: { queryKey: string }): null {
  useQuery({
    queryKey: [queryKey] as const,
    queryFn: () => fetchSpy(queryKey),
  });
  return null;
}

type InvalidatePlanning = ReturnType<typeof useInvalidatePlanningRelated>;

/**
 * Menyimpan fungsi invalidasi supaya tes bisa memanggilnya pada saat yang
 * ditentukan. Penugasannya di dalam efek, bukan saat render: menugaskan
 * variabel luar saat render adalah side effect yang hasilnya bergantung pada
 * kapan React kebetulan me-render ulang.
 */
const holder: { invalidate?: InvalidatePlanning } = {};

function CaptureInvalidate(): null {
  const invalidate = useInvalidatePlanningRelated();

  useEffect(() => {
    holder.invalidate = invalidate;
  }, [invalidate]);

  return null;
}

const invalidatePlanning: InvalidatePlanning = (options) => {
  if (!holder.invalidate) {
    throw new Error("Hook invalidasi belum siap");
  }
  holder.invalidate(options);
};

/** Berapa kali key tertentu di-fetch sejak awal tes. */
const fetchCountFor = (key: string) =>
  fetchSpy.mock.calls.filter(([called]) => called === key).length;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(async () => {
  fetchSpy.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
    },
  });

  await act(async () => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <CaptureInvalidate />
        <ActiveQuery queryKey={DETAIL_KEY} />
        <ActiveQuery queryKey={LIST_KEY} />
      </QueryClientProvider>,
    );
  });
  await flush();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("useInvalidatePlanningRelated", () => {
  it("me-refetch seluruh query planning yang aktif", async () => {
    const detailBefore = fetchCountFor(DETAIL_KEY);
    const listBefore = fetchCountFor(LIST_KEY);

    await act(async () => {
      invalidatePlanning();
    });
    await flush();

    expect(fetchCountFor(DETAIL_KEY)).toBeGreaterThan(detailBefore);
    expect(fetchCountFor(LIST_KEY)).toBeGreaterThan(listBefore);
  });

  it("tidak me-refetch key yang dikecualikan, tetapi tetap me-refetch sisanya", async () => {
    const detailBefore = fetchCountFor(DETAIL_KEY);
    const listBefore = fetchCountFor(LIST_KEY);

    await act(async () => {
      invalidatePlanning({ except: [DETAIL_KEY] });
    });
    await flush();

    // Inti regresi: rencana yang baru dihapus tidak boleh diambil ulang.
    expect(fetchCountFor(DETAIL_KEY)).toBe(detailBefore);
    expect(fetchCountFor(LIST_KEY)).toBeGreaterThan(listBefore);
  });
});
