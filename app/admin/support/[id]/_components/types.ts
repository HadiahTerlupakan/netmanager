export interface ReplyAttachment {
  url: string;
}

export interface Reply {
  id: string;
  message: string;
  isFromAdmin: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    image?: string;
  } | null;
  attachments?: string[] | null;
}

export interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    email: string | null;
    noTelp: string | null;
    alamat: string | null;
    status: string;
    hargaPaket: { name: string } | null;
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  replies: Reply[];
}

export const TICKET_STATUS_OPTIONS = [
  { value: "OPEN", label: "Baru" },
  { value: "IN_PROGRESS", label: "Dalam Proses" },
  { value: "WAITING_CUSTOMER", label: "Menunggu Pelanggan" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "CLOSED", label: "Ditutup" },
] as const;

export function getStatusBorderColor(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-red-100 text-red-700 border-red-200";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "WAITING_CUSTOMER":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "RESOLVED":
      return "bg-green-100 text-green-700 border-green-200";
    case "CLOSED":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case "URGENT":
      return { label: "Urgent", color: "text-red-600" };
    case "HIGH":
      return { label: "Tinggi", color: "text-orange-600" };
    case "MEDIUM":
      return { label: "Medium", color: "text-yellow-600" };
    case "LOW":
      return { label: "Rendah", color: "text-gray-600" };
    default:
      return { label: priority, color: "text-gray-600" };
  }
}

export function getCategoryLabel(category: string) {
  switch (category) {
    case "TECHNICAL":
      return "Masalah Teknis";
    case "BILLING":
      return "Tagihan & Pembayaran";
    case "ACCOUNT":
      return "Akun";
    case "OTHER":
      return "Lainnya";
    default:
      return category;
  }
}
