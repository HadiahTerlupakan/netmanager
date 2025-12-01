/**
 * Comprehensive TypeScript types for Portal Pelanggan
 */

// ============================================
// Core Pelanggan Types
// ============================================

export interface PelangganData {
    id: string
    idPelanggan: string
    nama: string
    username: string
    email?: string | null
    noTelp?: string | null
    alamat?: string | null
    status: 'AKTIF' | 'NON_AKTIF' | 'SUSPEND'
    tipe: 'REGULER' | 'NON_REGULER'
    tanggalAktif: string
    jatuhTempo: string
    hargaPaketId?: string | null
    hargaPaket?: HargaPaket | null
    createdAt: string
    updatedAt: string
}

export interface HargaPaket {
    id: string
    name: string
    harga: number
    durasi: number
    profilePPP?: ProfilePPP | null
    bandwidth?: Bandwidth | null
}

export interface ProfilePPP {
    id: string
    name: string
    localAddress: string
}

export interface Bandwidth {
    id: string
    name: string
    maxLimitDownload: number
    maxLimitUpload: number
}

// ============================================
// Tagihan Types
// ============================================

export type TagihanStatus = 'LUNAS' | 'BELUM_LUNAS' | 'TERLAMBAT'

export interface Tagihan {
    id: string
    pelangganId: string
    periodeBulan: number
    periodeTahun: number
    jumlah: number
    total: number
    jatuhTempo: string
    status: TagihanStatus
    tanggalBayar?: string | null
    metodeBayar?: string | null
    keterangan?: string | null
    createdAt: string
    updatedAt: string
    pelanggan?: PelangganData
}

export interface TagihanListItem {
    id: string
    bulan: string
    tahun: number
    jumlah: number
    total: number
    jatuhTempo: string
    status: TagihanStatus
    tanggalBayar?: string
}

// ============================================
// Payment Types
// ============================================

export type PaymentMethod = 'QRIS' | 'VIRTUAL_ACCOUNT' | 'RETAIL' | 'EWALLET' | 'MANUAL_TRANSFER'

export interface PaymentGateway {
    provider: string
    name: string
    enabled: boolean
    methods: PaymentMethod[]
    fee?: number
    description?: string
}

export interface PaymentRequest {
    tagihanId: string
    provider: string
    method: PaymentMethod
    channel?: string
}

export interface PaymentResponse {
    success: boolean
    orderId: string
    reference?: string
    checkoutUrl?: string
    qrUrl?: string
    vaNumber?: string
    paymentCode?: string
    expiryTime?: string
    amount: number
    fee?: number
    total: number
    error?: string
}

export interface ManualPaymentData {
    tagihanId: string
    bankAccountId: string
    amount: number
    transferDate: string
    transferTime: string
    senderName: string
    proofImagePath: string
    notes?: string
}

// ============================================
// Ticket/Support Types
// ============================================

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface TicketCategory {
    id: string
    name: string
    description?: string
}

export interface Ticket {
    id: string
    pelangganId: string
    categoryId: string
    subject: string
    description: string
    status: TicketStatus
    priority: TicketPriority
    createdAt: string
    updatedAt: string
    resolvedAt?: string | null
    category?: TicketCategory
    pelanggan?: PelangganData
    replies?: TicketReply[]
}

export interface TicketReply {
    id: string
    ticketId: string
    message: string
    isStaff: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateTicketRequest {
    categoryId: string
    subject: string
    description: string
}

// ============================================
// RADIUS Types
// ============================================

export interface RadiusConnectionStatus {
    isOnline: boolean
    ipAddress?: string
    uptimeHours?: number
    downloadMB?: number
    uploadMB?: number
    sessionStartTime?: string
}

export interface RadiusUsageStats {
    totalDownloadGB: number
    totalUploadGB: number
    totalSessionHours: number
    averageSpeed?: {
        download: number
        upload: number
    }
}

export interface RadiusSession {
    id: string
    username: string
    startTime: string
    endTime?: string
    duration: number
    ipAddress: string
    downloadBytes: number
    uploadBytes: number
    terminateCause?: string
}

// ============================================
// Component Props Types
// ============================================

export interface TagihanCardProps {
    tagihan: TagihanListItem
    onPayment: (tagihanId: string) => void
    onDownloadInvoice: (tagihanId: string) => void
}

export interface EmptyStateProps {
    title: string
    description: string
    icon?: React.ComponentType<{ className?: string }>
    action?: {
        label: string
        href: string
    }
}

export interface LoadingStateProps {
    message?: string
    fullPage?: boolean
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface ApiErrorResponse {
    error: string
    message?: string
    statusCode?: number
}

// ============================================
// Form Types
// ============================================

export interface LoginFormValues {
    idPelanggan: string
    password: string
}

export interface CreateTicketFormValues {
    categoryId: string
    subject: string
    description: string
}

export interface ManualPaymentFormValues {
    bankAccountId: string
    amount: number
    transferDate: string
    transferTime: string
    senderName: string
    proofImage: File | null
    notes?: string
}

// ============================================
// Storage Types
// ============================================

export interface StorageValue<T> {
    value: T
    expiry: number
}

// ============================================
// Hook Return Types
// ============================================

export interface UsePelangganReturn {
    data: PelangganData | null
    loading: boolean
    refreshing: boolean
    lastRefreshTime: Date | null
    refresh: () => void
}

export interface UseTagihanReturn {
    tagihan: Tagihan | null
    loading: boolean
    error: string | null
    refresh: () => void
}

export interface UseTicketsReturn {
    tickets: Ticket[]
    loading: boolean
    error: string | null
    refresh: () => void
}
