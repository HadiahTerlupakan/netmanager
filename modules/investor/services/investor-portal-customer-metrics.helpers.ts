import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";

const ZERO_NUMBER = 0;
const FULL_PERCENT = 100;
const ACTIVE_INTERNAL_STATUS = "AKTIF";

export type InvestorPortalInternalCustomers = Awaited<
  ReturnType<InvestorPortalRepository["findInternalCustomers"]>
>;

export type InvestorPortalInternalCustomer =
  InvestorPortalInternalCustomers[number];

export type CustomerMetrics = {
  total: number;
  active: number;
  paying: number;
  revenue: number;
};

/** Mengumpulkan siteId unik dari proyek yang terhubung ke site internal. */
export function collectInternalSiteIds<
  T extends { rabProject: { siteId: string | null } },
>(projects: T[]): string[] {
  return [
    ...new Set(projects.map((item) => item.rabProject.siteId).filter(Boolean)),
  ];
}

/** Meringkas metrik seluruh pelanggan internal yang diberikan. */
export function summarizeInternalCustomers(
  customers: InvestorPortalInternalCustomers,
  now: Date,
): CustomerMetrics {
  let active = ZERO_NUMBER;
  let paying = ZERO_NUMBER;
  let revenue = ZERO_NUMBER;

  for (const customer of customers) {
    if (!isInternalCustomerActive(customer)) {
      continue;
    }

    active += 1;

    if (!isInternalCustomerPaying(customer, now)) {
      continue;
    }

    paying += 1;
    revenue += getInternalCustomerRevenue(customer);
  }

  return {
    total: customers.length,
    active,
    paying,
    revenue,
  };
}

/** Meringkas metrik pelanggan internal untuk satu site. */
export function summarizeInternalCustomersBySite(
  customers: InvestorPortalInternalCustomers,
  siteId: string,
  now: Date,
): CustomerMetrics {
  let total = ZERO_NUMBER;
  let active = ZERO_NUMBER;
  let paying = ZERO_NUMBER;
  let revenue = ZERO_NUMBER;

  for (const customer of customers) {
    if (customer.siteId !== siteId) {
      continue;
    }

    total += 1;

    if (!isInternalCustomerActive(customer)) {
      continue;
    }

    active += 1;

    if (!isInternalCustomerPaying(customer, now)) {
      continue;
    }

    paying += 1;
    revenue += getInternalCustomerRevenue(customer);
  }

  return { total, active, paying, revenue };
}

/** Menghitung persentase pelanggan aktif yang sudah membayar. */
export function calculatePaymentRatio(active: number, paying: number): number {
  if (active === ZERO_NUMBER) {
    return ZERO_NUMBER;
  }

  return Math.round((paying / active) * FULL_PERCENT);
}

function isInternalCustomerActive(
  customer: InvestorPortalInternalCustomer,
): boolean {
  return customer.status === ACTIVE_INTERNAL_STATUS;
}

function isInternalCustomerPaying(
  customer: InvestorPortalInternalCustomer,
  now: Date,
): boolean {
  return isInternalCustomerActive(customer) && customer.jatuhTempo > now;
}

function getInternalCustomerRevenue(
  customer: InvestorPortalInternalCustomer,
): number {
  return Number(customer.hargaPaket?.harga || 0);
}
