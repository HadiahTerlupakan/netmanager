import type { OnuDatasetCollection, OnuItem } from "./snmp-optimized.helpers";

export function buildEmptyPagination(pageSize: number) {
  return {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
  };
}

export function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getPagedIndexes(
  statusData: Record<string, string>,
  page: number,
  pageSize: number,
): string[] {
  const indexes = Object.keys(statusData);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, indexes.length);
  return indexes.slice(startIndex, endIndex);
}

export function buildPaginatedOnuItems(
  indexes: string[],
  oltId: string,
  datasets: OnuDatasetCollection,
  buildOnuItem: (params: {
    index: string;
    oltId: string;
    datasets: OnuDatasetCollection;
  }) => OnuItem,
): OnuItem[] {
  return indexes.map((index) => buildOnuItem({ index, oltId, datasets }));
}
