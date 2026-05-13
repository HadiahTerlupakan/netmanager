"use client";

import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { PublicBrandingProvider } from "@/contexts/PublicBrandingContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      enableColorScheme={false}
    >
      <SessionProvider>
        <PublicBrandingProvider>{children}</PublicBrandingProvider>
      </SessionProvider>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
