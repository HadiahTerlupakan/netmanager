import Image from 'next/image';
import { useRef } from 'react'
import { format } from 'date-fns'
import {
    HiPhoto,
    HiCheckCircle,
    HiChatBubbleLeft,
    HiPaperAirplane,
    HiLockClosed,
    HiTrash,
} from 'react-icons/hi2'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { TimelineItem, WorkOrderUpdateType, WorkOrderAttachment } from '../types'

interface WoDiscussionTabProps {
    discussionItems: TimelineItem[]
    currentUserId: string | undefined
    workOrderStatus: string
    canUpdate: boolean
    newComment: string
    setNewComment: (v: string) => void
    addingComment: boolean
    handleAddComment: () => void
    isUploading: boolean
    fileInputRef: React.RefObject<HTMLInputElement | null>
    onDeleteAttachment: (attachmentId: string) => void
    discussionLightboxOpen: boolean
    setDiscussionLightboxOpen: (v: boolean) => void
    discussionLightboxIndex: number
    setDiscussionLightboxIndex: (v: number) => void
}

export function WoDiscussionTab({
    discussionItems,
    currentUserId,
    workOrderStatus,
    canUpdate,
    newComment,
    setNewComment,
    addingComment,
    handleAddComment,
    isUploading,
    fileInputRef,
    onDeleteAttachment,
    discussionLightboxOpen,
    setDiscussionLightboxOpen,
    discussionLightboxIndex,
    setDiscussionLightboxIndex,
}: WoDiscussionTabProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const sortedItems = [...discussionItems].sort((a, b) => a.date.getTime() - b.date.getTime())
    const isLocked = ['COMPLETED', 'CANCELLED', 'VERIFIED'].includes(workOrderStatus) || !canUpdate

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {/* Discussion Items (Chat Stream) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                {sortedItems.length > 0 ? (
                    sortedItems.map((item, index) => {
                        const attData = item.data as WorkOrderAttachment
                        const updateData = item.data as WorkOrderUpdateType
                        const isComment = item.type === 'comment'

                        const creatorId = isComment ? updateData.user?.id : attData.user?.id
                        const isMe = creatorId && currentUserId ? creatorId === currentUserId : false

                        const user = isComment ? updateData.user : attData.user
                        const creatorName = user?.name || user?.email || 'Unknown'

                        const prevItem = index > 0 ? sortedItems[index - 1] : null
                        const prevCreatorId = prevItem
                            ? (prevItem.type === 'comment' ? (prevItem.data as WorkOrderUpdateType).user?.id : (prevItem.data as WorkOrderAttachment).user?.id)
                            : null
                        const isSequence = prevCreatorId === creatorId

                        return (
                            <div key={item.id} className={`flex w-full gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {!isMe && (
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                                        isSequence ? 'invisible' : 'bg-linear-to-br from-indigo-500 to-purple-500'
                                    }`}>
                                        {creatorName.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && !isSequence && (
                                        <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-1 font-medium">
                                            {creatorName}
                                        </span>
                                    )}

                                    {/* Bubble */}
                                    <div className={`relative px-4 py-2.5 shadow-sm ${
                                        isMe
                                            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm'
                                    }`}>
                                        {isComment ? (
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {updateData.message}
                                            </p>
                                        ) : (
                                            <div className="-mx-2 -mt-2 group relative">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const attachmentItems = discussionItems.filter(i => i.type === 'attachment')
                                                        const attachmentIndex = attachmentItems.findIndex(i => i.id === item.id)
                                                        setDiscussionLightboxIndex(attachmentIndex >= 0 ? attachmentIndex : 0)
                                                        setDiscussionLightboxOpen(true)
                                                    }}
                                                    className="block w-full cursor-pointer"
                                                >
                                                    <Image width={0} height={0} sizes="100vw" style={{ width: "100%", height: "auto" }}
                                                        src={attData.filePath}
                                                        alt={attData.caption || 'Attachment'}
                                                        className={`rounded-lg object-cover max-h-60 min-w-[200px] w-full hover:opacity-90 transition-opacity ${isMe ? 'bg-indigo-500' : 'bg-gray-100'}`}
                                                    />
                                                </button>

                                                {isMe && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onDeleteAttachment(item.id)
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                        title="Hapus gambar"
                                                    >
                                                        <HiTrash className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                {attData.caption && (
                                                    <p className="text-sm mt-2 px-2 pb-1 opacity-90">
                                                        {attData.caption}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Timestamp */}
                                        <div className={`text-[10px] mt-1 text-right flex justify-end gap-1 ${
                                            isMe ? 'text-indigo-100/80' : 'text-gray-400'
                                        }`}>
                                            {format(item.date, 'HH:mm')}
                                            {isMe && <HiCheckCircle className="w-3 h-3" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 mb-4">
                            <HiChatBubbleLeft className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada diskusi</p>
                        <p className="text-sm text-gray-400 mt-1">Mulai percakapan dengan tim Anda disini</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            {isLocked ? (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-2">
                        <HiLockClosed className="w-4 h-4" />
                        {!canUpdate ? 'Anda tidak memiliki akses untuk berkomentar' : `Diskusi ditutup (Status: ${workOrderStatus})`}
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-all shrink-0"
                            title="Upload Foto"
                        >
                            <HiPhoto className="w-7 h-7" />
                        </button>

                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-300 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 focus-within:shadow-sm overflow-hidden transition-all duration-200">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Ketik pesan..."
                                className="w-full px-5 py-3 border-none! ring-0! outline-none! bg-transparent text-sm min-h-[48px] max-h-[140px] resize-none text-gray-700 dark:text-gray-200 leading-normal"
                                style={{ height: 'auto' }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement
                                    target.style.height = 'auto'
                                    target.style.height = `${target.scrollHeight}px`
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleAddComment()
                                    }
                                }}
                            />
                        </div>

                        <button
                            onClick={handleAddComment}
                            disabled={addingComment || !newComment.trim()}
                            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shrink-0 shadow-sm ${
                                !newComment.trim()
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200 dark:shadow-none'
                            }`}
                            title="Kirim Pesan"
                        >
                            <HiPaperAirplane className={`w-6 h-6 -rotate-90 ${newComment.trim() ? 'translate-x-0.5' : ''}`} />
                        </button>
                    </div>
                </div>
            )}

            {/* ImageLightbox for Discussion Photos */}
            <ImageLightbox
                images={discussionItems
                    .filter(i => i.type === 'attachment')
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map(i => (i.data as WorkOrderAttachment).filePath)}
                initialIndex={discussionLightboxIndex}
                isOpen={discussionLightboxOpen}
                onClose={() => setDiscussionLightboxOpen(false)}
                alt="Foto Diskusi"
            />
        </div>
    )
}
