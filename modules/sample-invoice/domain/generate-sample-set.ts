import { FAMILY_NAMES, FIRST_NAMES } from "./indonesian-names";
import { daysInMonth, invoiceLines, monthsInRange } from "./money";
import { between, pick } from "./random";
import type {
  PaymentMethod,
  SampleCustomer,
  SampleGenerateInput,
  SampleInvoice,
  SampleSet,
  SampleStreet,
} from "./types";

const PHONE_PREFIXES = [
  "0812",
  "0813",
  "0821",
  "0852",
  "0857",
  "0878",
  "0896",
] as const;
const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "Transfer bank",
  "QRIS",
  "E-wallet",
  "Tunai",
];
const MAX_HOUSE_NUMBER = 200;
const ROAD_PREFIX = /^(jl\.?|jalan|gg\.?|gang)\s/i;

const pad = (value: number, length: number) =>
  String(value).padStart(length, "0");

function formatAddress(street: SampleStreet, houseNumber: number) {
  const road = ROAD_PREFIX.test(street.name)
    ? street.name
    : `Jl. ${street.name}`;
  return [
    `${road} No. ${houseNumber}`,
    street.village,
    street.district,
    street.city,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Nomor lengkap tidak pernah dibuat: bisa saja milik orang sungguhan. */
function maskedPhone(random: () => number) {
  return `${pick(PHONE_PREFIXES, random)}-****-${pad(between(0, 9999, random), 4)}`;
}

function createCustomer(
  index: number,
  input: SampleGenerateInput,
  random: () => number,
): SampleCustomer {
  return {
    code: `CTH-${pad(index + 1, 4)}`,
    name: `${pick(FIRST_NAMES, random)} ${pick(FAMILY_NAMES, random)}`,
    address: formatAddress(
      pick(input.streets, random),
      between(1, MAX_HOUSE_NUMBER, random),
    ),
    phoneMasked: maskedPhone(random),
    packageIndex: between(0, input.packages.length - 1, random),
  };
}

function paidDay(
  month: string,
  input: SampleGenerateInput,
  today: string,
  random: () => number,
) {
  if (input.payDate.mode === "fixed") return input.payDate.day;
  const lastDay =
    month === today.slice(0, 7)
      ? Number(today.slice(8, 10))
      : daysInMonth(month);
  return between(1, lastDay, random);
}

/**
 * Set contoh: satu invoice per pelanggan per bulan, dengan nama, alamat, dan
 * paket pelanggan yang tetap di setiap bulan. Masukan dianggap sudah valid.
 */
export function generateSampleSet(
  input: SampleGenerateInput,
  opts: { today: string; random: () => number },
): SampleSet {
  const customers = Array.from({ length: input.customerCount }, (_, index) =>
    createCustomer(index, input, opts.random),
  );

  const invoices: SampleInvoice[] = [];
  for (const month of monthsInRange(input.fromMonth, input.toMonth)) {
    customers.forEach((customer, customerIndex) => {
      const amounts = { dpp: 0, ppn: 0, total: 0 };
      for (const line of invoiceLines(
        input.packages[customer.packageIndex],
        input.ppn,
      )) {
        amounts.dpp += line.dpp;
        amounts.ppn += line.ppn;
        amounts.total += line.total;
      }
      invoices.push({
        number: `CTH/${month.replace("-", "/")}/${customer.code.slice(4)}`,
        customerIndex,
        month,
        dueDate: `${month}-${pad(input.dueDay, 2)}`,
        paidDate: `${month}-${pad(paidDay(month, input, opts.today, opts.random), 2)}`,
        method: pick(PAYMENT_METHODS, opts.random),
        ...amounts,
      });
    });
  }
  return { customers, invoices };
}
