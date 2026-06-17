type WorkOrderListRouteFilters = Record<
  string,
  string | string[] | boolean | Date
>;

export class AdminWorkOrderFilterBuilder {
  /** Bangun filter list work order dari query string route admin. */
  buildListFilters(searchParams: URLSearchParams): WorkOrderListRouteFilters {
    const filters: WorkOrderListRouteFilters = {};

    this.assignListFilters(filters, searchParams);
    this.assignScalarFilters(filters, searchParams);
    this.assignDateRangeFilters(filters, searchParams);
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

  /**
   * Petakan rentang tanggal (createdAt) dari query string. `dateFrom` dipatok
   * ke awal hari dan `dateTo` ke akhir hari agar batas atas inklusif terhadap
   * seluruh work order pada tanggal tersebut.
   */
  private assignDateRangeFilters(
    filters: WorkOrderListRouteFilters,
    searchParams: URLSearchParams,
  ) {
    const dateFrom = this.parseDateBoundary(
      searchParams.get("dateFrom"),
      "start",
    );
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = this.parseDateBoundary(searchParams.get("dateTo"), "end");
    if (dateTo) filters.dateTo = dateTo;
  }

  private parseDateBoundary(
    value: string | null,
    boundary: "start" | "end",
  ): Date | null {
    if (!value) return null;
    const time = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const parsed = new Date(`${value}${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
