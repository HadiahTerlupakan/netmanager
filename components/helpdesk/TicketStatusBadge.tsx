import React from 'react';
import { TicketStatus } from '@prisma/client';

interface TicketStatusBadgeProps {
    status: TicketStatus;
    className?: string;
}

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
    OPEN: {
        label: 'Baru',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    IN_PROGRESS: {
        label: 'Sedang Ditangani',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    WAITING_CUSTOMER: {
        label: 'Menunggu Respon',
        className: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    RESOLVED: {
        label: 'Selesai',
        className: 'bg-green-100 text-green-800 border-green-200',
    },
    CLOSED: {
        label: 'Ditutup',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
    },
};

export const TicketStatusBadge: React.FC<TicketStatusBadgeProps> = ({ status, className = '' }) => {
    const config = statusConfig[status];

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
        >
            {config.label}
        </span>
    );
};
