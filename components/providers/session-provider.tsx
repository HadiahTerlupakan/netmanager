"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PublicBrandingProvider } from "@/contexts/PublicBrandingContext";

/**
 * Buat QueryClient sekali per instance React tree.
 *
 * Default options:
 * - `refetchOnWindowFocus: false` — sejalan dengan setup SWR sebelumnya
 *   (data fetching tidak agresif, hindari spam request saat tab focus)
 * - `retry: false` — tidak retry otomatis on error; UI handle error eksplisit
 * - `staleTime: 30s` — cache fresh 30 detik untuk batch request berdekatan
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 30_000,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      enableColorScheme={false}
    >
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <PublicBrandingProvider>{children}</PublicBrandingProvider>
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          )}
        </QueryClientProvider>
      </SessionProvider>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
