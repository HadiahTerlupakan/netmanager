import type {
  FetchCustomersParams,
  MixRadiusCustomer,
} from "./mixradius-types";

/** Sort MixRadius customers according to requested field and direction. */
export function sortCustomers(
  customers: MixRadiusCustomer[],
  filters: FetchCustomersParams,
) {
  const { sortBy = "expired_on", sortDir = "asc", authStatus } = filters;
  const sortedCustomers = [...customers];
  if (!sortBy && authStatus === "Isolir") {
    return sortedCustomers.sort((left, right) =>
      compareDateValues(left.expired_on, right.expired_on, "asc"),
    );
  }

  return sortedCustomers.sort((left, right) =>
    compareCustomerValues({ left, right, sortBy, sortDir }),
  );
}

type CustomerComparisonInput = {
  left: MixRadiusCustomer;
  right: MixRadiusCustomer;
  sortBy: string;
  sortDir: "asc" | "desc";
};

function compareCustomerValues(input: CustomerComparisonInput) {
  if (["expired_on", "renewed_on", "created_at"].includes(input.sortBy)) {
    return compareCustomerDates(input);
  }

  return compareCustomerStrings(input);
}

function compareCustomerDates(input: CustomerComparisonInput) {
  const sortKey = input.sortBy as keyof MixRadiusCustomer;
  return compareDateValues(
    input.left[sortKey],
    input.right[sortKey],
    input.sortDir,
  );
}

function compareCustomerStrings(input: CustomerComparisonInput) {
  const sortKey = input.sortBy as keyof MixRadiusCustomer;
  const leftValue = String(input.left[sortKey] || "").toLowerCase();
  const rightValue = String(input.right[sortKey] || "").toLowerCase();
  return compareStringValues(leftValue, rightValue, input.sortDir);
}

function compareDateValues(
  left: unknown,
  right: unknown,
  sortDir: "asc" | "desc",
) {
  const leftTime = left ? new Date(String(left)).getTime() : 0;
  const rightTime = right ? new Date(String(right)).getTime() : 0;
  return sortDir === "asc" ? leftTime - rightTime : rightTime - leftTime;
}

function compareStringValues(
  left: string,
  right: string,
  sortDir: "asc" | "desc",
) {
  if (left < right) return sortDir === "asc" ? -1 : 1;
  if (left > right) return sortDir === "asc" ? 1 : -1;
  return 0;
}
