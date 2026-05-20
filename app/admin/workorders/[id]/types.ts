export interface MaterialDetailData {
  id: string;
  type: "keluar" | "masuk";
  tanggal: string;
  createdAt: string;
  barang: { kode: string; nama: string; satuan: string };
  gudang: { kode: string; nama: string };
  jumlah: number;
  kondisi: string;
  keterangan: string | null;
  user: { name: string | null; email: string } | null;
  fotoBukti?: string[];
}

export interface WorkOrderUpdateType {
  id: string;
  updateType: string;
  message: string;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface WorkOrderAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  caption: string | null;
  uploadedAt: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface WorkOrderDetail {
  id: string;
  workOrderNumber: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
  locationAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isInternal?: boolean;
  estimatedHours: number | null;
  actualHours: number | null;
  resolutionNotes: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    email: string | null;
    noTelp: string | null;
  } | null;
  ticket?: {
    ticketNumber: string;
    subject: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  assignedMitra?: {
    id: string;
    name: string;
  } | null;
  department?: {
    name: string;
  } | null;
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    order: number;
  }>;
  updates?: Array<WorkOrderUpdateType>;
  attachments?: Array<WorkOrderAttachment>;
  assignments?: Array<{
    id: string;
    role: string;
    user?: {
      id: string;
      name: string;
    };
  }>;
  materials?: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    barang: {
      kode: string;
      nama: string;
      satuan: string;
    };
  }>;
  createdBy?: {
    id: string;
    name: string | null;
  } | null;
}

export type TimelineItem =
  | { type: "comment"; date: Date; id: string; data: WorkOrderUpdateType }
  | { type: "update"; date: Date; id: string; data: WorkOrderUpdateType }
  | { type: "attachment"; date: Date; id: string; data: WorkOrderAttachment };

export const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  ASSIGNED: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  IN_PROGRESS:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  ON_HOLD:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  COMPLETED:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  VERIFIED:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  CLOSED: "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};
