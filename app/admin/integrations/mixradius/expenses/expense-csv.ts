export interface ExpenseCsvRow {
  date: string
  amount: string
  category: string
  expenseCategoryName: string
  rabText: string
  description: string
  siteOrGroup: string
  petugas: string
}

const FORMULA_PREFIXES = ['=', '+', '-', '@']

function normalizeCsvValue(value: string): string {
  const sanitized = value.replace(/\r?\n/g, ' ').trim()
  if (!sanitized) {
    return ''
  }

  if (FORMULA_PREFIXES.includes(sanitized[0])) {
    return `'${sanitized}`
  }

  return sanitized
}

function escapeCsvCell(value: string): string {
  return `"${normalizeCsvValue(value).replace(/"/g, '""')}"`
}

export function buildExpenseCsvContent(rows: ExpenseCsvRow[]): string {
  const headers = ['Tanggal', 'Jumlah', 'Tipe', 'Kategori', 'RAB', 'Keterangan', 'Site/Group', 'Petugas']

  const mappedRows = rows.map((row) => [
    escapeCsvCell(new Date(row.date).toLocaleDateString('id-ID')),
    escapeCsvCell(row.amount),
    escapeCsvCell(row.category),
    escapeCsvCell(row.expenseCategoryName),
    escapeCsvCell(row.rabText),
    escapeCsvCell(row.description),
    escapeCsvCell(row.siteOrGroup),
    escapeCsvCell(row.petugas),
  ])

  return [headers.map(escapeCsvCell).join(','), ...mappedRows.map((row) => row.join(','))].join('\n')
}
