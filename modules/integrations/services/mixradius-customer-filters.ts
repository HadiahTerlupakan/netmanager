import { MixRadiusOwnerGroupFacadeService } from "./MixRadiusOwnerGroupFacadeService";
import {
  buildMixRadiusOwnerLookup,
  isMixRadiusOwnerAllowed,
  normalizeMixRadiusOwnerName,
} from "@/modules/integrations/services/mixradius-owner-normalizer";

import { sortCustomers } from "./mixradius-customer-sort";
import type {
  FetchCustomersParams,
  MixRadiusCustomer,
} from "./mixradius-types";

const ownerGroupService = new MixRadiusOwnerGroupFacadeService();

/** Apply all supported customer filters in a deterministic order. */
export async function applyCustomerFilters(
  customers: MixRadiusCustomer[],
  filters: FetchCustomersParams,
): Promise<MixRadiusCustomer[]> {
  let filteredCustomers = customers;
  filteredCustomers = await filterBySite(filteredCustomers, filters.siteId);
  filteredCustomers = filterByAuthStatus(filteredCustomers, filters.authStatus);
  filteredCustomers = filterBySearch(
    filteredCustomers,
    filters.search,
    filters.searchType,
  );
  filteredCustomers = await filterByGroup(filteredCustomers, filters.groupId);
  filteredCustomers = filterByOwnerName(filteredCustomers, filters.ownerName);
  filteredCustomers = filterByOnlineStatus(
    filteredCustomers,
    filters.onlineStatus,
  );
  return sortCustomers(filteredCustomers, filters);
}

function filterBySearch(
  customers: MixRadiusCustomer[],
  search?: string,
  searchType?: string,
) {
  if (!search) {
    return customers;
  }

  const normalizedSearch = search.toLowerCase();
  if (searchType === "all" || !searchType) {
    return customers.filter((customer) =>
      matchesAnyCustomerField(customer, normalizedSearch),
    );
  }

  return customers.filter((customer) => {
    const fieldValue = (customer as unknown as Record<string, unknown>)[
      searchType
    ];
    return (
      Boolean(fieldValue) &&
      String(fieldValue).toLowerCase().includes(normalizedSearch)
    );
  });
}

function matchesAnyCustomerField(
  customer: MixRadiusCustomer,
  normalizedSearch: string,
) {
  return [
    customer.fullname,
    customer.username,
    customer.member_id,
    customer.address,
    customer.phonenumber,
    customer.owner_name,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function filterByAuthStatus(
  customers: MixRadiusCustomer[],
  authStatus?: string,
) {
  if (!authStatus) {
    return customers;
  }

  if (authStatus === "Isolir") {
    return customers.filter(isExpiredCustomer);
  }

  if (authStatus === "Disabled-Users") {
    return customers.filter(isDisabledOrExpiredCustomer);
  }

  return customers.filter((customer) => customer.auth_status === authStatus);
}

function isExpiredCustomer(customer: MixRadiusCustomer) {
  const expiredDate = customer.expired_on
    ? new Date(customer.expired_on)
    : null;
  return (
    Boolean(expiredDate) &&
    !Number.isNaN(expiredDate.getTime()) &&
    expiredDate < new Date()
  );
}

function isDisabledOrExpiredCustomer(customer: MixRadiusCustomer) {
  if (["Disabled-Users", "disabled"].includes(customer.auth_status)) {
    return true;
  }

  return isExpiredCustomer(customer);
}

async function filterBySite(customers: MixRadiusCustomer[], siteId?: string) {
  if (!siteId) {
    return customers;
  }

  const siteOwners = await ownerGroupService.getOwnersBySiteId(siteId);
  const allowedOwners = buildMixRadiusOwnerLookup(siteOwners);
  return customers.filter((customer) =>
    isMixRadiusOwnerAllowed(customer.owner_name, allowedOwners),
  );
}

async function filterByGroup(customers: MixRadiusCustomer[], groupId?: string) {
  if (!groupId) {
    return customers;
  }

  const groupOwners = await ownerGroupService.getOwnersByGroupId(groupId);
  if (!groupOwners || groupOwners.length === 0) {
    return [];
  }

  const allowedOwners = buildMixRadiusOwnerLookup(groupOwners);
  return customers.filter((customer) =>
    isMixRadiusOwnerAllowed(customer.owner_name, allowedOwners),
  );
}

function filterByOwnerName(customers: MixRadiusCustomer[], ownerName?: string) {
  if (!ownerName) {
    return customers;
  }

  const normalizedOwner = normalizeMixRadiusOwnerName(ownerName);
  return customers.filter((customer) => {
    if (!customer.owner_name) {
      return false;
    }

    const candidateOwner = normalizeMixRadiusOwnerName(customer.owner_name);
    return (
      candidateOwner.full === normalizedOwner.full ||
      candidateOwner.prefix === normalizedOwner.prefix
    );
  });
}

function filterByOnlineStatus(
  customers: MixRadiusCustomer[],
  onlineStatus?: "online" | "offline",
) {
  if (!onlineStatus) {
    return customers;
  }

  const isOnline = onlineStatus === "online";
  return customers.filter((customer) => customer.online === isOnline);
}
