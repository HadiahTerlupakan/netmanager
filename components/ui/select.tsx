import React, { useState } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || '')

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue)
    onChange?.(optionValue)
    setIsOpen(false)
  }

  const selectedOption = options.find(option => option.value === selectedValue)

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="py-1 max-h-60 overflow-auto">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none
                    ${option.value === selectedValue ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                  `}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
      <ul className="py-1 max-h-60 overflow-auto">
        {children}
      </ul>
    </div>
  )
}

export function SelectItem({ children, onClick, selected }: {
  children: React.ReactNode
  onClick: () => void
  selected?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`
          w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none
          ${selected ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
        `}
      >
        {children}
      </button>
    </li>
  )
}

export function SelectTrigger({ children, onClick, placeholder }: {
  children: React.ReactNode
  onClick: () => void
  placeholder?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-gray-400"
    >
      <span className={children ? 'text-gray-900' : 'text-gray-500'}>
        {children || placeholder}
      </span>
      <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </span>
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return (
    <span className="text-gray-500">
      {placeholder}
    </span>
  )
}

export default Select