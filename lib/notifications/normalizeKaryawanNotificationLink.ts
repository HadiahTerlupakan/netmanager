export function normalizeKaryawanNotificationLink(link?: string | null): string {
  if (!link) {
    return '#'
  }

  if (link.startsWith('/admin/workorders') || link.startsWith('/admin/work-order')) {
    return '/karyawan/work-order'
  }

  return link
}
