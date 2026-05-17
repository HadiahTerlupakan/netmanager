"use client";

import React, { useState, useRef, useCallback } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { useClickOutside } from "@/hooks/useClickOutside";

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export default function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select or type...",
  className = "",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Pattern C: sync searchTerm with value prop during render
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setSearchTerm(value);
  }

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(wrapperRef, closeDropdown);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelect = (option: string) => {
    // setSearchTerm(option) // Controlled by parent via effect, but good for immediate responsiveness
    onChange(option);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-8"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
          <HiChevronDown className="w-4 h-4" />
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => (
            <div
              key={index}
              className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
              onClick={() => handleSelect(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
