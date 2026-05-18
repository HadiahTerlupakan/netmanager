"use client";

import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  /** Callback untuk fetch next page. */
  onLoadMore: () => void;
  /** Disable observer saat tidak ada page selanjutnya. */
  hasNextPage: boolean;
  /** Spinner / placeholder saat fetch in-flight. */
  isFetchingNextPage: boolean;
  /** Optional: rootMargin untuk trigger lebih awal. Default "200px". */
  rootMargin?: string;
}

/**
 * Sentinel element yang trigger `onLoadMore` saat masuk viewport.
 * Pakai bersamaan dengan `useInfiniteApi` untuk auto-load page berikutnya.
 *
 * Letakkan di akhir list:
 *   <ul>
 *     {items.map(...)}
 *     <InfiniteScrollSentinel
 *       onLoadMore={fetchNextPage}
 *       hasNextPage={hasNextPage}
 *       isFetchingNextPage={isFetchingNextPage}
 *     />
 *   </ul>
 */
export function InfiniteScrollSentinel({
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = "200px",
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore, rootMargin]);

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isFetchingNextPage && (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      )}
      {!hasNextPage && (
        <span className="text-xs text-gray-400">— akhir daftar —</span>
      )}
    </div>
  );
}
