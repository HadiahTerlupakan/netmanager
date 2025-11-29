import React from 'react';
import { TicketPriority } from '@prisma/client';
import { HiExclamationCircle, HiArrowUp, HiMinus, HiArrowDown } from 'react-icons/hi2';

interface TicketPriorityBadgeProps {
    priority: TicketPriority;
    className?: string;
    showIcon?: boolean;
}

const priorityConfig: Record<TicketPriority, { label: string; className: string; icon: React.ComponentType<any> }> = {
    LOW: {
        label: 'Rendah',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: HiArrowDown,
    },
    NORMAL: {
        label: 'Normal',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: HiMinus,
    },
    HIGH: {
        label: 'Tinggi',
        className: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: HiArrowUp,
    },
    URGENT: {
        label: 'Mendesak',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: HiExclamationCircle,
    },
};

export const TicketPriorityBadge: React.FC<TicketPriorityBadgeProps> = ({
    priority,
    className = '',
    showIcon = true
}) => {
    const config = priorityConfig[priority];
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
        >
            {showIcon && <Icon className="w-3 h-3" />}
            <span>{config.label}</span>
        </span>
    );
};
