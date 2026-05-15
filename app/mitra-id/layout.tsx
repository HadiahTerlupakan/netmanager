import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kartu Tanda Mitra - NetManager",
};

export default function MitraIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-10 px-4 print:bg-white print:p-0">
      {children}
    </div>
  );
}
