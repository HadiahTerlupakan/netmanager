import { logger } from "@/lib/logger";
import type { MixRadiusCustomer } from "@/modules/integrations";
import {
  getMixRadiusService,
  matchesMixRadiusOwner,
} from "@/modules/integrations";
import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";

const MIXRADIUS_FETCH_LIMIT = 10000;
const MIXRADIUS_SNAPSHOT_TTL_MS = 60_000;
const ACTIVE_MIXRADIUS_STATUSES = new Set(["Active", "Enabled-Users"]);
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

export function collectInternalSiteIds<
  T extends { rabProject: { siteId: string | null } },
>(projects: T[]): string[] {
  return [
    ...new Set(projects.map((item) => item.rabProject.siteId).filter(Boolean)),
  ];
}

export function collectMixRadiusSiteIds<
  T extends { rabProject: { mixRadiusInvestorSiteId: string | null } },
>(projects: T[]): string[] {
  return [
    ...new Set(
      projects
        .map((item) => item.rabProject.mixRadiusInvestorSiteId)
        .filter(Boolean),
    ),
  ];
}

export function collectMixRadiusOwners(
  sites: Array<{ owners: string[] | null }>,
): string[] {
  return [...new Set(sites.flatMap((site) => site.owners || []))];
}

export function createInvestorSiteMap<T extends { id: string }>(
  sites: T[],
): Map<string, T> {
  return new Map(sites.map((site) => [site.id, site]));
}

type MixRadiusSnapshot = {
  data: MixRadiusCustomer[];
  expiresAt: number;
};

let mixRadiusSnapshot: MixRadiusSnapshot | null = null;
let mixRadiusInflight: Promise<MixRadiusCustomer[]> | null = null;

export async function fetchMixRadiusCustomers(
  owners: string[],
  logPrefix: string,
): Promise<MixRadiusCustomer[]> {
  if (owners.length === ZERO_NUMBER) {
    return [];
  }

  const now = Date.now();
  if (mixRadiusSnapshot && mixRadiusSnapshot.expiresAt > now) {
    return mixRadiusSnapshot.data;
  }

  if (mixRadiusInflight) {
    return mixRadiusInflight;
  }

  mixRadiusInflight = (async () => {
    try {
      const response = await getMixRadiusService().fetchCustomersPPP({
        start: 0,
        length: MIXRADIUS_FETCH_LIMIT,
        forceRefresh: false,
      });
      const data = response.data || [];
      mixRadiusSnapshot = {
        data,
        expiresAt: Date.now() + MIXRADIUS_SNAPSHOT_TTL_MS,
      };
      return data;
    } catch (error) {
      logger.error(`${logPrefix} MixRadius fetch error:`, error);
      return [];
    } finally {
      mixRadiusInflight = null;
    }
  })();

  return mixRadiusInflight;
}

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

export function summarizeMixRadiusCustomers(
  customers: MixRadiusCustomer[],
  owners: string[],
  now: Date,
): CustomerMetrics {
  let total = ZERO_NUMBER;
  let active = ZERO_NUMBER;
  let revenue = ZERO_NUMBER;

  for (const customer of customers) {
    if (!matchesMixRadiusOwner(customer.owner_name, owners)) {
      continue;
    }

    total += 1;

    if (!isMixRadiusCustomerActive(customer, now)) {
      continue;
    }

    active += 1;
    revenue += Number(customer.total || 0);
  }

  return {
    total,
    active,
    paying: active,
    revenue,
  };
}

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

function isMixRadiusCustomerActive(
  customer: MixRadiusCustomer,
  now: Date,
): boolean {
  if (!ACTIVE_MIXRADIUS_STATUSES.has(customer.auth_status)) {
    return false;
  }

  if (!customer.expired_on) {
    return true;
  }

  const expiredDate = new Date(customer.expired_on);
  return !Number.isNaN(expiredDate.getTime()) && expiredDate >= now;
}
