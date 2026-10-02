/** Baris work order dari GET /api/admin/workorders (dipakai tabel & PDF). */
export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  locationAddress?: string | null;
  isInternal: boolean;
  requestedById: string | null;
  pelanggan?: {
    nama: string;
    idPelanggan: string;
    noTelp?: string | null;
  } | null;
  assignedTo?: {
    name: string;
    role?: {
      isTechnical: boolean;
    } | null;
  } | null;
  assignedMitra?: {
    name: string;
  } | null;
  department?: {
    name: string;
  } | null;
  site?: {
    name: string;
  } | null;
  createdBy?: {
    name: string | null;
    role?: {
      isTechnical: boolean;
    } | null;
  } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

