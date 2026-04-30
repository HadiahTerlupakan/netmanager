const LINE_WIDTH = 40;
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type SalaryReceiptDetail = {
  type: "EARNING" | "DEDUCTION";
  name: string;
  amount: number;
  quantity?: number;
};

export type SalaryReceiptData = {
  month: number;
  year: number;
  user: {
    name: string | null;
    employeeType: string | null;
    departments?: { name: string };
    sites?: { name: string };
  };
  details: SalaryReceiptDetail[];
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  paidAt?: string | Date | null;
};

type SalaryReceiptSource = SalaryReceiptData;

const separator = "=".repeat(LINE_WIDTH);
const dotLine = "-".repeat(LINE_WIDTH);
const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function centerText(text: string) {
  const padding = Math.floor((LINE_WIDTH - text.length) / 2);
  return " ".repeat(Math.max(padding, 0)) + text;
}

function formatLine(label: string, value: string, indent = 0) {
  const spaces = " ".repeat(indent);
  const labelWidth = LINE_WIDTH - value.length - indent - 1;
  return `${spaces}${label.padEnd(labelWidth)} ${value}`;
}

function formatDetailLabel(detail: SalaryReceiptDetail) {
  if (!detail.quantity) return detail.name;
  return `${detail.name} (${detail.quantity}x)`;
}

function formatDetails(details: SalaryReceiptDetail[]) {
  return details
    .map((detail) =>
      formatLine(formatDetailLabel(detail), formatCurrency(detail.amount), 2),
    )
    .join("\n");
}

function buildEmployeeLines(salary: SalaryReceiptData) {
  const lines = [
    formatLine("Nama", salary.user.name || "-"),
    formatLine("Tipe", salary.user.employeeType || "KARYAWAN"),
  ];

  if (salary.user.departments?.name) {
    lines.push(formatLine("Departemen", salary.user.departments.name));
  }

  if (salary.user.sites?.name) {
    lines.push(formatLine("Site", salary.user.sites.name));
  }

  return lines;
}

export function mapSalaryReceiptData(
  salary: SalaryReceiptSource,
): SalaryReceiptData {
  return {
    month: salary.month,
    year: salary.year,
    user: salary.user,
    details: salary.details,
    totalEarnings: salary.totalEarnings,
    totalDeductions: salary.totalDeductions,
    netSalary: salary.netSalary,
    status: salary.status,
    paidAt: salary.paidAt,
  };
}

function buildPaymentLines(salary: SalaryReceiptData) {
  if (!salary.paidAt) return [];

  const paidDate = new Date(salary.paidAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return [centerText(`Dibayar: ${paidDate}`)];
}

export function formatSalarySlipReceipt(salary: SalaryReceiptData) {
  const lines = [
    ...buildReceiptHeader(salary),
    ...buildEmployeeLines(salary),
    ...buildEarningLines(salary),
    ...buildDeductionLines(salary),
    ...buildReceiptFooter(salary),
  ];
  return `${lines.join("\n")}\n`;
}

function buildReceiptHeader(salary: SalaryReceiptData) {
  return [
    separator,
    centerText("SLIP GAJI"),
    centerText(`${MONTH_NAMES[salary.month - 1]} ${salary.year}`),
    separator,
  ];
}

function buildEarningLines(salary: SalaryReceiptData) {
  const earnings = salary.details.filter((detail) => detail.type === "EARNING");
  return [
    dotLine,
    "PENDAPATAN:",
    formatDetails(earnings),
    dotLine,
    formatLine("Total Pendapatan", formatCurrency(salary.totalEarnings)),
    dotLine,
  ];
}

function buildDeductionLines(salary: SalaryReceiptData) {
  const deductions = salary.details.filter(
    (detail) => detail.type === "DEDUCTION",
  );
  if (deductions.length === 0) return [];
  return [
    "POTONGAN:",
    formatDetails(deductions),
    dotLine,
    formatLine("Total Potongan", formatCurrency(salary.totalDeductions)),
    dotLine,
  ];
}

function buildReceiptFooter(salary: SalaryReceiptData) {
  return [
    separator,
    formatLine("GAJI BERSIH", formatCurrency(salary.netSalary)),
    separator,
    "",
    centerText(`Status: ${salary.status}`),
    ...buildPaymentLines(salary),
    "",
    centerText("Terima kasih"),
    separator,
  ];
}
