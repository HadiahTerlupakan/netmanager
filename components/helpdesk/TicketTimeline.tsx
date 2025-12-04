import React from 'react';
import type { TicketMessage, TicketAttachment } from '@prisma/client';
import { HiUser, HiUserCircle, HiPaperClip } from 'react-icons/hi2';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface MessageWithAttachments extends TicketMessage {
    attachments?: TicketAttachment[];
}

interface TicketTimelineProps {
    messages: MessageWithAttachments[];
    className?: string;
}

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ messages, className = '' }) => {
    const formatTime = (date: Date | string) => {
        return formatDistanceToNow(new Date(date), { addSuffix: true, locale: localeId });
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {messages.map((message, index) => {
                const isStaff = message.senderType === 'STAFF';
                const isInternal = message.isInternal;

                return (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${isInternal ? 'bg-yellow-50 p-3 rounded-lg border border-yellow-200' : ''}`}
                    >
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${isStaff ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                {isStaff ? <HiUserCircle className="w-6 h-6" /> : <HiUser className="w-6 h-6" />}
                            </div>
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{message.senderName}</p>
                                {isInternal && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                        Internal Note
                                    </span>
                                )}
                                {message.isFirstResponse && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                        First Response
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{formatTime(message.createdAt)}</p>

                            {/* Message Text */}
                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
                                {message.message}
                            </div>

                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-3 space-y-1">
                                    {message.attachments.map((attachment) => (
                                        <a
                                            key={attachment.id}
                                            href={`/uploads/${attachment.filePath}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 hover:underline"
                                        >
                                            <HiPaperClip className="w-4 h-4" />
                                            <span className="truncate">{attachment.fileName}</span>
                                            <span className="text-xs text-gray-500">
                                                ({(attachment.fileSize / 1024).toFixed(1)} KB)
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {messages.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                    Belum ada percakapan
                </div>
            )}
        </div>
    );
};
