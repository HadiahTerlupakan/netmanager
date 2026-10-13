/** Bentuk opsi ringan yang dipakai beberapa halaman admin. */
export interface SiteOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  _count?: { children: number };
}
