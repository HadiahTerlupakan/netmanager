import { redirect } from "next/navigation";

import { buildInventoryCatalogTabHref } from "../barang/catalogTabs";

/** Alamat lama Master Jasa; daftar jasa kini tab di halaman Manajemen Barang. */
export default function JasaPage(): never {
  redirect(buildInventoryCatalogTabHref("jasa"));
}
