import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
    HiClock,
    HiPhoto,
    HiCube,
    HiArrowUturnLeft,
    HiTrash,
} from 'react-icons/hi2'
import type { TimelineItem, WorkOrderUpdateType, WorkOrderAttachment } from '../types'

interface WoActivityTimelineProps {
    timelineLogItems: TimelineItem[]
    currentUserId: string | undefined
    onFetchMaterialDetail: (updateId: string, updateType: string) => void
    onDeleteAttachment: (attachmentId: string) => void
}

export function WoActivityTimeline({
    timelineLogItems,
    currentUserId,
    onFetchMaterialDetail,
    onDeleteAttachment,
}: WoActivityTimelineProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                {timelineLogItems.length > 0 ? (
                    timelineLogItems.map((item) => {
                        const attData = item.data as WorkOrderAttachment
                        const updateData = item.data as WorkOrderUpdateType
                        const isUpdate = item.type === 'update'

                        const user = isUpdate ? updateData.user : attData.user
                        const userName = user?.name || user?.email || 'Unknown User'
                        const isMe = user?.id && currentUserId ? user.id === currentUserId : false

                        return (
                            <div key={item.id} className="flex gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    updateData?.updateType === 'MATERIAL_PICKUP' ? 'bg-orange-100 dark:bg-orange-900/30'
                                    : updateData?.updateType === 'MATERIAL_RETURN' ? 'bg-green-100 dark:bg-green-900/30'
                                    : updateData?.updateType === 'STATUS_CHANGE' ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : item.type === 'update' ? 'bg-sky-100 dark:bg-sky-900/30'
                                    : 'bg-orange-100 dark:bg-orange-900/30'
                                    }`}>
                                    {updateData?.updateType === 'MATERIAL_PICKUP' ? (
                                        <HiCube className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    ) : updateData?.updateType === 'MATERIAL_RETURN' ? (
                                        <HiArrowUturnLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : item.type === 'update' ? (
                                        <HiClock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                    ) : (
                                        <HiPhoto className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    {item.type === 'update' ? (
                                        <div className="">
                                            {updateData.updateType === 'MATERIAL_PICKUP' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onFetchMaterialDetail(updateData.id, updateData.updateType)}
                                                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded mb-1 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                                                >
                                                    📦 Ambil Barang
                                                </button>
                                            )}
                                            {updateData.updateType === 'MATERIAL_RETURN' && (
                                                <button
                                                    type="button"
                                                    onClick={() => onFetchMaterialDetail(updateData.id, updateData.updateType)}
                                                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded mb-1 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                                                >
                                                    ↩️ Kembalikan Barang
                                                </button>
                                            )}
                                            {updateData.updateType === 'STATUS_CHANGE' && (
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded mb-1">
                                                    🔄 Perubahan Status
                                                </span>
                                            )}
                                            <p className={`text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap ${
                                                (updateData.updateType === 'MATERIAL_PICKUP' || updateData.updateType === 'MATERIAL_RETURN')
                                                    ? 'cursor-pointer hover:text-gray-700 dark:hover:text-white' : ''
                                            }`}
                                                onClick={() => {
                                                    if (updateData.updateType === 'MATERIAL_PICKUP' || updateData.updateType === 'MATERIAL_RETURN') {
                                                        onFetchMaterialDetail(updateData.id, updateData.updateType)
                                                    }
                                                }}
                                            >{updateData.message}</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 mb-1 inline-block group relative">
                                            <a
                                                href={attData.filePath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                            >
                                                <img
                                                    src={attData.filePath}
                                                    alt={attData.caption || 'Attachment'}
                                                    className="h-40 rounded-lg object-cover mb-2"
                                                />
                                            </a>

                                            {isMe && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        onDeleteAttachment(item.id)
                                                    }}
                                                    className="absolute top-4 right-4 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                                                    title="Hapus gambar"
                                                >
                                                    <HiTrash className="w-3.5 h-3.5" />
                                                </button>
                                            )}

                                            {attData.caption && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                    {attData.caption.replace(/^\[(HOLD|NOTE)\]\s*/, '')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {userName} · {format(item.date, 'dd MMM yyyy HH:mm', { locale: localeId })}
                                    </p>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Belum ada aktivitas sistem.</p>
                )}
            </div>
        </div>
    )
}
