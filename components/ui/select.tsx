import React, { useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const triggerBase =
  "w-full px-3 py-2 text-left bg-surface text-neutral-text-strong border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

const menuBase =
  "absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-lg";

const itemBase =
  "w-full px-3 py-2 text-left hover:bg-surface-variant focus:bg-surface-variant focus:outline-none";

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || "");

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue);
    onChange?.(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`${triggerBase} ${
          disabled
            ? "bg-surface-variant cursor-not-allowed opacity-70"
            : "cursor-pointer hover:border-primary/60"
        }`}
      >
        <span
          className={
            selectedOption
              ? "text-neutral-text-strong"
              : "text-muted-foreground"
          }
        >
          {selectedOption?.label || placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="w-5 h-5 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {isOpen && !disabled && (
        <div className={menuBase}>
          <ul className="py-1 max-h-60 overflow-auto">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`${itemBase} ${
                    option.value === selectedValue
                      ? "bg-primary/10 text-primary"
                      : "text-neutral-text-strong"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <div className={menuBase}>
      <ul className="py-1 max-h-60 overflow-auto">{children}</ul>
    </div>
  );
}

export function SelectItem({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`${itemBase} ${
          selected ? "bg-primary/10 text-primary" : "text-neutral-text-strong"
        }`}
      >
        {children}
      </button>
    </li>
  );
}

export function SelectTrigger({
  children,
  onClick,
  placeholder,
}: {
  children: React.ReactNode;
  onClick: () => void;
  placeholder?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${triggerBase} cursor-pointer hover:border-primary/60`}
    >
      <span
        className={
          children ? "text-neutral-text-strong" : "text-muted-foreground"
        }
      >
        {children || placeholder}
      </span>
      <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg
          className="w-5 h-5 text-muted-foreground"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-muted-foreground">{placeholder}</span>;
}

export default Select;
