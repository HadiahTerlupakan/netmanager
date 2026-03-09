interface DailyExpenseIndicatorInput {
  date: string
  amount: string
  category: string
  siteId: string | null
  mixRadiusGroupId: string | null
  description: string | null
  invoiceNumber: string | null
  invoiceFile: string | null
}

export interface DailyExpenseIndicators {
  suspectedDuplicateCount: number
  pendingVerificationCount: number
}

function normalizeText(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeDate(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return date.toISOString().slice(0, 10)
}

function buildDuplicateKey(item: DailyExpenseIndicatorInput): string {
  const siteScope = item.mixRadiusGroupId || item.siteId || 'general'
  const invoiceNumber = normalizeText(item.invoiceNumber)

  if (invoiceNumber) {
    return [
      siteScope,
      item.category,
      item.amount,
      invoiceNumber,
    ].join('|')
  }

  return [
    normalizeDate(item.date),
    siteScope,
    item.category,
    item.amount,
    normalizeText(item.description),
  ].join('|')
}

export function buildDailyExpenseIndicators(data: DailyExpenseIndicatorInput[]): DailyExpenseIndicators {
  const duplicateCountMap = new Map<string, number>()
  let pendingVerificationCount = 0

  for (const item of data) {
    const key = buildDuplicateKey(item)
    duplicateCountMap.set(key, (duplicateCountMap.get(key) ?? 0) + 1)

    const hasInvoiceNumber = normalizeText(item.invoiceNumber).length > 0
    const hasInvoiceFile = normalizeText(item.invoiceFile).length > 0
    if (!hasInvoiceNumber && !hasInvoiceFile) {
      pendingVerificationCount += 1
    }
  }

  let suspectedDuplicateCount = 0
  for (const count of duplicateCountMap.values()) {
    if (count > 1) {
      suspectedDuplicateCount += count - 1
    }
  }

  return {
    suspectedDuplicateCount,
    pendingVerificationCount,
  }
}
