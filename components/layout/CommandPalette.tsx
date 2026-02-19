"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  HiMagnifyingGlass,
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineServer,
  HiOutlinePresentationChartLine,
  HiOutlineDevicePhoneMobile,
  HiPlus,
  HiOutlineClipboard,
  HiOutlineBolt,
  HiOutlineLink,
  HiOutlineHome,
  HiOutlineMap,
  HiOutlineUsers,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineQueueList,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack,
  HiOutlineUser,
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineCog6Tooth,
  HiOutlinePhoto,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCodeBracket,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineWrench,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardDocumentList,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineMegaphone,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice,
  HiOutlineClipboardDocumentCheck,
  HiOutlineTag,
  HiOutlineTicket,
  HiOutlineMapPin,
  HiOutlineSpeakerWave,
  HiOutlineArrowPath,
  HiOutlineShoppingBag,
  HiOutlineBuildingLibrary,
  HiOutlineChartPie,
  HiOutlineComputerDesktop,
  HiOutlinePresentationChartBar,
  HiOutlineCloud,
  HiOutlineArrowsRightLeft,
  HiOutlineNoSymbol,
} from 'react-icons/hi2'
import { ADMIN_MENU_CONFIG, EMPLOYEE_MENU_CONFIG, type MenuConfig } from '@/lib/menu-config'
import { usePermission } from '@/hooks/use-permission'

const IconMap: Record<string, React.ElementType> = {
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineServer,
  HiOutlinePresentationChartLine,
  HiOutlineDevicePhoneMobile,
  HiPlus,
  HiOutlineClipboard,
  HiOutlineBolt,
  HiOutlineLink,
  HiOutlineHome,
  HiOutlineMap,
  HiOutlineUsers,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineQueueList,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack,
  HiOutlineUser,
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineCog6Tooth,
  HiOutlinePhoto,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCodeBracket,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineWrench,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardDocumentList,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineMegaphone,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice,
  HiOutlineClipboardDocumentCheck,
  HiOutlineTag,
  HiOutlineTicket,
  HiOutlineMapPin,
  HiOutlineSpeakerWave,
  HiOutlineArrowPath,
  HiOutlineShoppingBag,
  HiOutlineBuildingLibrary,
  HiOutlineChartPie,
  HiOutlineComputerDesktop,
  HiOutlinePresentationChartBar,
  HiOutlineCloud,
  HiOutlineArrowsRightLeft,
  HiOutlineNoSymbol,
}

interface SearchItem {
  code: string
  name: string
  path: string
  icon?: string
  section?: string
  parentName?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  portal?: 'admin' | 'karyawan'
}

export default function CommandPalette({ isOpen, onClose, portal = 'admin' }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { hasPermission } = usePermission()

  // Build searchable items from menu config, filtered by permissions
  const searchItems: SearchItem[] = useMemo(() => {
    const menuConfig = portal === 'admin' ? ADMIN_MENU_CONFIG : EMPLOYEE_MENU_CONFIG
    const items: SearchItem[] = []

    const processMenu = (menu: MenuConfig, parentName?: string) => {
      // Only include items that have a navigable path
      if (menu.path) {
        const permissionResource = menu.code
          ? (menu.code.includes('.') ? menu.code.split('.').pop()! : menu.code)
          : ''
        const hasAccess = permissionResource
          ? hasPermission(`${permissionResource.toLowerCase()}:read`)
          : true

        if (hasAccess) {
          items.push({
            code: menu.code,
            name: menu.name,
            path: menu.path,
            icon: menu.icon,
            section: menu.section,
            parentName,
          })
        }
      }

      if (menu.children) {
        for (const child of menu.children) {
          processMenu(child, menu.name)
        }
      }
    }

    for (const menu of menuConfig) {
      processMenu(menu)
    }

    return items
  }, [portal, hasPermission])

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return searchItems
    const lowerQuery = query.toLowerCase()
    return searchItems.filter(item => {
      const searchTarget = `${item.name} ${item.parentName || ''} ${item.section || ''}`.toLowerCase()
      return searchTarget.includes(lowerQuery)
    })
  }, [query, searchItems])

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleClose = useCallback(() => {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }, [onClose])

  const handleSelect = useCallback((item: SearchItem) => {
    handleClose()
    router.push(item.path)
  }, [handleClose, router])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % filteredItems.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredItems[activeIndex]) {
          handleSelect(filteredItems[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }, [filteredItems, activeIndex, handleSelect, handleClose])

  if (!isOpen || typeof document === 'undefined') return null

  const getIcon = (iconName: string | undefined) => {
    if (!iconName || !IconMap[iconName]) return null
    const Icon = IconMap[iconName]
    return <Icon className="w-4 h-4" />
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-150"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[15vh] px-4">
        <div
          className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <HiMagnifyingGlass className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari halaman..."
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            <kbd className="text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;
              </div>
            ) : (
              <>
                {filteredItems.map((item, index) => {
                  const isActive = index === activeIndex
                  return (
                    <button
                      key={item.code}
                      data-index={index}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-75 ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <span className={`shrink-0 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400'}`}>
                        {getIcon(item.icon) || <HiOutlineDocument className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        {item.parentName && (
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                            {item.parentName}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-600 truncate max-w-[120px] hidden sm:block">
                        {item.path}
                      </span>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">↑↓</kbd>
              navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">↵</kbd>
              buka
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">esc</kbd>
              tutup
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
