import "./globals.css";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/session-provider";
import ConsoleWarning from "@/components/security/ConsoleWarning";

export const dynamic = "force-dynamic";

// Optimized font loading with next/font - eliminates render-blocking
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      "https://radpro.id",
  ),
  title: {
    default: "RADPRO.ID — Platform Manajemen ISP All-in-One",
    template: "%s | RADPRO.ID",
  },
  description:
    "Platform manajemen ISP all-in-one: billing otomatis, MikroTik & OLT, portal pelanggan, monitoring real-time, dan manajemen karyawan.",
  applicationName: "RADPRO.ID",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`h-full ${inter.variable}`}
      data-scroll-behavior="smooth"
    >
      {/*
        Ekstensi browser (password manager, Grammarly, dan sejenisnya) kerap
        menyuntikkan atribut ke <body> sebelum React hydrate — misalnya
        __processed_<uuid>__="true" — dan itu memicu hydration mismatch yang
        tidak berasal dari kode kita. suppressHydrationWarning hanya berlaku
        untuk elemen ini sendiri, bukan turunannya, jadi mismatch asli di
        dalam aplikasi tetap terlaporkan.
      */}
      <body suppressHydrationWarning className={`h-full m-0 ${inter.className}`}>
        <ConsoleWarning />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
