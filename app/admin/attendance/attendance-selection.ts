/**
 * Toggle satu ID absensi di daftar terpilih.
 */
export function toggleAttendanceSelection(
  selectedIds: string[],
  id: string,
): string[] {
  if (selectedIds.includes(id)) {
    return selectedIds.filter((selectedId) => selectedId !== id);
  }

  return [...selectedIds, id];
}

/**
 * Toggle seleksi seluruh ID pada halaman aktif.
 */
export function toggleCurrentPageAttendanceSelection(
  selectedIds: string[],
  currentPageIds: string[],
  shouldSelectAll: boolean,
): string[] {
  if (shouldSelectAll) {
    return [...new Set([...selectedIds, ...currentPageIds])];
  }

  const currentPageIdSet = new Set(currentPageIds);
  return selectedIds.filter((id) => !currentPageIdSet.has(id));
}

/**
 * Cek apakah semua ID absensi pada halaman aktif sudah terpilih.
 */
export function areAllAttendanceIdsSelected(
  selectedIds: string[],
  currentPageIds: string[],
): boolean {
  if (currentPageIds.length === 0) {
    return false;
  }

  const selectedIdSet = new Set(selectedIds);
  return currentPageIds.every((id) => selectedIdSet.has(id));
}
