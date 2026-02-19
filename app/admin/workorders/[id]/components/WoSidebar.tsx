import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
    HiUserCircle,
    HiCalendar,
    HiMapPin,
    HiPhoto,
    HiCheckCircle,
} from 'react-icons/hi2'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { WorkOrderDetail, WorkOrderAttachment } from '../types'

interface WoSidebarProps {
    workOrder: WorkOrderDetail
    completionAttachments: WorkOrderAttachment[]
    lightboxOpen: boolean
    setLightboxOpen: (v: boolean) => void
    lightboxIndex: number
    setLightboxIndex: (v: number) => void
}

export function WoSidebar({
    workOrder,
    completionAttachments,
    lightboxOpen,
    setLightboxOpen,
    lightboxIndex,
    setLightboxIndex,
}: WoSidebarProps) {
    const showCompletionReport = ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(workOrder.status)

    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiUserCircle className="w-5 h-5" />
                    Customer Info
                    {!workOrder.pelanggan && (
                        <span className="text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">Guest</span>
                    )}
                </h3>
                <div className="space-y-3 text-sm">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400">Name</p>
                        <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan?.nama || workOrder.contactName || '-'}</p>
                    </div>
                    {workOrder.pelanggan?.idPelanggan && (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">ID</p>
                            <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan.idPelanggan}</p>
                        </div>
                    )}
                    {workOrder.pelanggan?.email && (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Email</p>
                            <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan.email}</p>
                        </div>
                    )}
                    {(workOrder.pelanggan?.noTelp || workOrder.contactPhone) && (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Phone</p>
                            <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan?.noTelp || workOrder.contactPhone}</p>
                        </div>
                    )}
                    {workOrder.locationAddress && (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Address</p>
                            <p className="font-medium text-gray-900 dark:text-white">{workOrder.locationAddress}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Completion Report */}
            {showCompletionReport && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-emerald-500">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HiCheckCircle className="w-5 h-5 text-emerald-600" />
                        Laporan Penyelesaian
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan Penyelesaian</h4>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-sm text-gray-800 dark:text-emerald-100">
                                {workOrder.resolutionNotes || <span className="text-gray-400 italic">Tidak ada catatan</span>}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto Dokumentasi ({completionAttachments.length})</h4>
                            {completionAttachments.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        {completionAttachments.map((att, index) => (
                                            <button
                                                key={att.id}
                                                onClick={() => {
                                                    setLightboxIndex(index)
                                                    setLightboxOpen(true)
                                                }}
                                                className="block group relative aspect-square cursor-pointer"
                                            >
                                                <img
                                                    src={att.filePath}
                                                    alt="Bukti Selesai"
                                                    className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700 group-hover:border-emerald-500 transition-colors"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                                                    <HiPhoto className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <ImageLightbox
                                        images={completionAttachments.map(att => att.filePath)}
                                        initialIndex={lightboxIndex}
                                        isOpen={lightboxOpen}
                                        onClose={() => setLightboxOpen(false)}
                                        alt="Foto Dokumentasi"
                                    />
                                </>
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">Tidak ada foto dokumentasi</p>
                            )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Diselesaikan oleh: {workOrder.assignedTo?.name}</span>
                            <span>{workOrder.completedAt ? format(new Date(workOrder.completedAt), 'dd MMM HH:mm', { locale: localeId }) : '-'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Assignment */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Assignment</h3>
                {workOrder.assignedTo ? (
                    <div className="text-sm">
                        <p className="text-gray-600 dark:text-gray-400">Assigned to:</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                            {workOrder.assignedTo.name}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Not assigned yet</p>
                )}
                {workOrder.department && (
                    <div className="text-sm mt-3">
                        <p className="text-gray-600 dark:text-gray-400">Department:</p>
                        <p className="font-medium text-gray-900 dark:text-white">{workOrder.department.name}</p>
                    </div>
                )}
                {workOrder.assignments && workOrder.assignments.filter((a: { role: string }) => a.role === 'PARTNER').length > 0 && (
                    <div className="text-sm mt-3">
                        <p className="text-gray-600 dark:text-gray-400">Partner:</p>
                        <div className="space-y-1 mt-1">
                            {workOrder.assignments
                                .filter((a: { role: string }) => a.role === 'PARTNER')
                                .map((a: { id: string; role: string; user?: { name?: string; firstName?: string; lastName?: string } }) => (
                                    <p key={a.id} className="font-medium text-gray-900 dark:text-white">{a.user?.name || a.user?.firstName + ' ' + a.user?.lastName}</p>
                                ))}
                        </div>
                    </div>
                )}
                {workOrder.createdBy && (
                    <div className="text-sm mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-400">Dibuat oleh:</p>
                        <p className="font-medium text-gray-900 dark:text-white">{workOrder.createdBy.name || '-'}</p>
                    </div>
                )}
            </div>

            {/* Schedule */}
            {workOrder.scheduledDate && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HiCalendar className="w-5 h-5" />
                        Schedule
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">Date</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: localeId })}
                            </p>
                        </div>
                        {workOrder.scheduledTimeStart && (
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Time</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {workOrder.scheduledTimeStart}
                                    {workOrder.scheduledTimeEnd && ` - ${workOrder.scheduledTimeEnd}`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Location */}
            {workOrder.locationAddress && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HiMapPin className="w-5 h-5" />
                        Location
                    </h3>
                    <p className="text-sm text-gray-900 dark:text-white">{workOrder.locationAddress}</p>
                    {workOrder.contactName && (
                        <div className="mt-3 text-sm">
                            <p className="text-gray-600 dark:text-gray-400">Contact</p>
                            <p className="font-medium text-gray-900 dark:text-white">{workOrder.contactName}</p>
                            {workOrder.contactPhone && (
                                <p className="text-gray-600 dark:text-gray-400">{workOrder.contactPhone}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
