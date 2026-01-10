'use client'

import { useState, useEffect } from 'react'

interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  badge?: string | number
}

interface TabNavigationProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  variant?: 'default' | 'pills' | 'underline'
  size?: 'sm' | 'md' | 'lg'
}

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  variant = 'default',
  size = 'md'
}: TabNavigationProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({})

  // Update indicator position when active tab changes
  useEffect(() => {
    if (variant === 'underline') {
      const activeTabElement = document.getElementById(`tab-${activeTab}`)
      if (activeTabElement) {
        const { offsetLeft, offsetWidth } = activeTabElement
        setIndicatorStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`
        })
      }
    }
  }, [activeTab, variant])

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab?.disabled) {
      onTabChange(tabId)
    }
  }

  const getTabClasses = (tab: TabItem) => {
    const isActive = activeTab === tab.id
    const isDisabled = tab.disabled

    const baseClasses = 'relative flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    const variantClasses = {
      default: `
        ${isActive 
          ? 'text-white bg-linear-to-r from-indigo-500 to-purple-600 shadow-md' 
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `,
      pills: `
        ${isActive 
          ? 'text-white bg-linear-to-r from-indigo-500 to-purple-600 shadow-md rounded-full' 
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `,
      underline: `
        ${isActive 
          ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        border-b-2 ${isActive ? 'border-indigo-600 dark:border-indigo-400' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}
      `
    }

    return cn(
      baseClasses,
      sizeClasses[size],
      variantClasses[variant],
      'touch-target'
    )
  }

  const containerClasses = {
    default: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1 gap-1',
    pills: 'bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1',
    underline: 'border-b border-gray-200 dark:border-gray-700 relative'
  }

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'flex',
        containerClasses[variant],
        variant === 'underline' ? 'overflow-x-auto scrollbar-hide' : ''
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => handleTabClick(tab.id)}
            disabled={tab.disabled}
            className={getTabClasses(tab)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.icon && (
              <span className="mr-2 shrink-0">
                {tab.icon}
              </span>
            )}
            <span className="truncate">{tab.label}</span>
            {tab.badge && (
              <span className={cn(
                'ml-2 px-2 py-0.5 text-xs rounded-full',
                activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        
        {/* Indicator for underline variant */}
        {variant === 'underline' && (
          <div
            className="absolute bottom-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
            style={indicatorStyle}
          />
        )}
      </div>
      
      {/* Mobile scroll indicator for underline variant */}
      {variant === 'underline' && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-white dark:from-gray-800 to-transparent pointer-events-none" />
      )}
    </div>
  )
}

// Helper function for className utility (simple implementation)
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}