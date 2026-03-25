'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import type { Range, RangeKeyDict } from 'react-date-range';
import { format, isSameDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  range: Range;
  onChange: (range: Range) => void;
  className?: string;
  placeholder?: string;
}

export function DateRangePicker({
  range,
  onChange,
  className,
  placeholder = 'Pilih rentang tanggal'
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ranges: RangeKeyDict) => {
    const selectedRange = ranges.selection;
    onChange(selectedRange);
    
    // Auto-close if different days selected (meaning range is complete)
    if (selectedRange.startDate && selectedRange.endDate && !isSameDay(selectedRange.startDate, selectedRange.endDate)) {
        // give small delay for UX
        setTimeout(() => setIsOpen(false), 300);
    }
  };

  const displayText = range.startDate && range.endDate 
    ? `${format(range.startDate, 'dd MMM yyyy', { locale: localeID })} - ${format(range.endDate, 'dd MMM yyyy', { locale: localeID })}`
    : placeholder;

  return (
    <div className={cn('relative inline-block w-full', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 opacity-50" />
          <span className="truncate">{displayText}</span>
        </div>
        {isOpen && <X className="h-4 w-4 opacity-50 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />}
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 rounded-lg border bg-popover p-1 shadow-md outline-none animate-in fade-in-0 zoom-in-95 overflow-hidden">
          <DateRange
            ranges={[range]}
            onChange={handleSelect}
            moveRangeOnFirstSelection={false}
            months={1}
            direction="vertical"
            locale={localeID}
            rangeColors={['#2563eb']} // blue-600
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
