/**
 * Terjemahkan tautan notifikasi ke halaman web admin.
 *
 * Sebagian notifikasi ditujukan ke aplikasi mobile dan memakai rute mobile
 * (mis. `/pengesahan/<id>`). Notifikasi yang sama juga tampil di lonceng web;
 * tanpa penerjemahan, rute mobile itu berakhir 404 di web.
 */

const MOBILE_TO_ADMIN_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  // Surat pengesahan: layar tanda tangan mobile → detail surat di admin.
  ["/pengesahan/", "/admin/pengesahan/"],
];

/** Tautan siap dipakai di web admin; tautan web dikembalikan apa adanya. */
export function toAdminNotificationLink(link: string): string {
  for (const [mobilePrefix, adminPrefix] of MOBILE_TO_ADMIN_PREFIXES) {
    if (link.startsWith(mobilePrefix)) {
      return adminPrefix + link.slice(mobilePrefix.length);
    }
  }

  return link;
}
