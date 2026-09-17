import { escapeCsvCell } from "@/lib/csv";

export interface ExpenseCsvRow {
  date: string;
  amount: string;
  category: string;
  expenseCategoryName: string;
  rabText: string;
  description: string;
  siteName: string;
  petugas: string;
}

export function buildExpenseCsvContent(rows: ExpenseCsvRow[]): string {
  const headers = [
    "Tanggal",
    "Jumlah",
    "Tipe",
    "Kategori",
    "RAB",
    "Keterangan",
    "Site",
    "Petugas",
  ];

  const mappedRows = rows.map((row) => [
    escapeCsvCell(new Date(row.date).toLocaleDateString("id-ID")),
    escapeCsvCell(row.amount),
    escapeCsvCell(row.category),
    escapeCsvCell(row.expenseCategoryName),
    escapeCsvCell(row.rabText),
    escapeCsvCell(row.description),
    escapeCsvCell(row.siteName),
    escapeCsvCell(row.petugas),
  ]);

  return [
    headers.map(escapeCsvCell).join(","),
    ...mappedRows.map((row) => row.join(",")),
  ].join("\n");
}
