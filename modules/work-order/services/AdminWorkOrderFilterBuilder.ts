type WorkOrderListRouteFilters = Record<string, string | string[] | boolean>;

export class AdminWorkOrderFilterBuilder {
  /** Bangun filter list work order dari query string route admin. */
  buildListFilters(searchParams: URLSearchParams): WorkOrderListRouteFilters {
    const filters: WorkOrderListRouteFilters = {};

    this.assignListFilters(filters, searchParams);
    this.assignScalarFilters(filters, searchParams);
    this.assignUnassignedFilter(filters, searchParams.get("unassignedOnly"));
    this.assignWorkOrderTypeFilter(filters, searchParams.get("woType"));
    return filters;
  }

  private assignListFilters(
    filters: WorkOrderListRouteFilters,
    searchParams: URLSearchParams,
  ) {
    this.assignListFilterValue(filters, "status", searchParams.get("status"));
    this.assignListFilterValue(
      filters,
      "priority",
      searchParams.get("priority"),
    );
    this.assignListFilterValue(filters, "type", searchParams.get("type"));
  }

  private assignScalarFilters(
    filters: WorkOrderListRouteFilters,
    searchParams: URLSearchParams,
  ) {
    this.assignScalarFilter(
      filters,
      "departmentId",
      searchParams.get("departmentId"),
    );
    this.assignScalarFilter(filters, "siteId", searchParams.get("siteId"));
    this.assignScalarFilter(
      filters,
      "assignedToId",
      searchParams.get("assignedToId"),
    );
    this.assignScalarFilter(filters, "search", searchParams.get("search"));
  }

  private assignListFilterValue(
    filters: WorkOrderListRouteFilters,
    key: string,
    value: string | null,
  ) {
    if (!value) return;
    filters[key] = value.includes(",") ? value.split(",") : value;
  }

  private assignScalarFilter(
    filters: WorkOrderListRouteFilters,
    key: string,
    value: string | null,
  ) {
    if (!value) return;
    filters[key] = value;
  }

  private assignUnassignedFilter(
    filters: WorkOrderListRouteFilters,
    value: string | null,
  ) {
    if (value === "true") filters.unassignedOnly = true;
  }

  private assignWorkOrderTypeFilter(
    filters: WorkOrderListRouteFilters,
    value: string | null,
  ) {
    if (value === "customer") {
      filters.isInternal = false;
      return;
    }
    if (value === "internal") filters.isInternal = true;
  }
}
