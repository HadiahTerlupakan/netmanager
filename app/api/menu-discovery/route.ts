/**
 * Optimized Menu Discovery API with Caching
 * 
 * Uses Next.js unstable_cache for server-side caching.
 * Menus are discovered from file system and cached for 5 minutes.
 * 
 * GET /api/menu-discovery?portal=admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { unstable_cache } from 'next/cache'
import * as fs from 'fs'
import * as path from 'path'

interface DiscoveredMenu {
    id: string
    code: string
    name: string
    parentCode: string | null
    path: string | null
    icon: string | null
    sortOrder: number
    portal: string
    children?: DiscoveredMenu[]
}

// Skip these folders
const SKIP_FOLDERS = new Set([
    'api', 'components', 'loading.tsx', 'error.tsx',
    'layout.tsx', 'not-found.tsx', 'debug-permissions',
    'page.tsx', 'ClientLayout.tsx', 'layout-client.tsx'
])

// Display name mappings
const NAME_MAPPINGS: Record<string, string> = {
    'olt': 'OLT', 'onu': 'ONU', 'onutype': 'ONU Type',
    'odp': 'ODP', 'odc': 'ODC', 'otb': 'OTB',
    'ftth': 'FTTH', 'hris': 'HRIS', 'mikrotik': 'Mikrotik',
    'vlan': 'VLAN', 'speedprofiles': 'Speed Profiles',
    'pelanggan': 'Pelanggan', 'inventory': 'Inventory',
    'workorders': 'Work Orders', 'helpdesk': 'Helpdesk',
    'pengaturan': 'Pengaturan', 'paket': 'Paket',
    'barang': 'Daftar Barang', 'gudang': 'Gudang',
    'masuk': 'Barang Masuk', 'keluar': 'Barang Keluar',
    'transfer': 'Transfer', 'opname': 'Stock Opname',
    'restock': 'Restock Alert', 'employees': 'Karyawan',
    'departments': 'Departemen', 'sites': 'Sites/Lokasi',
    'attendance': 'Absensi', 'payroll': 'Payroll',
    'leaves': 'Cuti', 'tagihan': 'Tagihan',
    'pengeluaran': 'Pengeluaran', 'bank-accounts': 'Rekening Bank',
    'cashflow': 'Cashflow', 'manual-payments': 'Pembayaran Manual',
    'umum': 'Umum', 'logo': 'Logo', 'email': 'Email',
    'whatsapp': 'WhatsApp', 'payment-gateway': 'Payment Gateway',
    'company-bank-accounts': 'Rekening Perusahaan',
    'oauth': 'OAuth', 'users': 'Pengguna', 'roles': 'Manajemen Role',
    'profile': 'Profil', 'payslips': 'Slip Gaji',
    'notifications': 'Notifikasi', 'joinbox': 'Joinbox',
    'pole': 'Pole', 'map': 'Network Map', 'radius': 'RADIUS',
    'network': 'Network', 'finance': 'Finance', 'dashboard': 'Dashboard',
    'new': 'Tambah Baru', 'list': 'Daftar',
}

function isDynamicRoute(name: string): boolean {
    return name.startsWith('[') && name.endsWith(']')
}

function shouldSkip(name: string): boolean {
    return SKIP_FOLDERS.has(name) ||
        name.startsWith('_') ||
        name.startsWith('.') ||
        isDynamicRoute(name) ||
        name.endsWith('.tsx') ||
        name.endsWith('.ts')
}

function toDisplayName(folder: string): string {
    const mapped = NAME_MAPPINGS[folder.toLowerCase()]
    if (mapped) return mapped
    return folder.split('-').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ')
}

function toCode(folder: string, parentCode: string | null): string {
    const base = folder.toUpperCase().replace(/-/g, '_')
    return parentCode ? `${parentCode}.${base}` : base
}

function scanDir(
    dirPath: string,
    portal: string,
    parentCode: string | null = null,
    basePath: string = '',
    sortStart: number = 0
): DiscoveredMenu[] {
    const menus: DiscoveredMenu[] = []

    if (!fs.existsSync(dirPath)) return menus

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        let sortOrder = sortStart

        for (const entry of entries) {
            if (!entry.isDirectory()) continue
            if (shouldSkip(entry.name)) continue

            const code = toCode(entry.name, parentCode)
            const menuPath = `${basePath}/${entry.name}`
            const fullPath = path.join(dirPath, entry.name)
            const hasPage = fs.existsSync(path.join(fullPath, 'page.tsx'))

            const menu: DiscoveredMenu = {
                id: code,
                code,
                name: toDisplayName(entry.name),
                parentCode,
                path: hasPage ? menuPath : null,
                icon: null,
                sortOrder: sortOrder * 10,
                portal,
                children: []
            }

            const children = scanDir(fullPath, portal, code, menuPath, 0)
            if (children.length > 0) {
                menu.children = children
            }

            menus.push(menu)
            sortOrder++
        }
    } catch (error) {
        console.error(`Error scanning ${dirPath}:`, error)
    }

    return menus
}

// Flatten menus for response
function flatten(items: DiscoveredMenu[]): DiscoveredMenu[] {
    const result: DiscoveredMenu[] = []
    for (const item of items) {
        const { children, ...rest } = item
        result.push(rest as DiscoveredMenu)
        if (children && children.length > 0) {
            result.push(...flatten(children))
        }
    }
    return result
}

// Cached menu discovery function
const getCachedMenus = unstable_cache(
    async (portal: string) => {
        const appDir = path.join(process.cwd(), 'app')
        let menus: DiscoveredMenu[] = []
        let basePath = ''

        switch (portal) {
            case 'admin':
                basePath = '/admin'
                menus = scanDir(path.join(appDir, 'admin'), 'admin', null, basePath)
                menus.unshift({
                    id: 'DASHBOARD',
                    code: 'DASHBOARD',
                    name: 'Dashboard',
                    parentCode: null,
                    path: '/admin',
                    icon: 'LayoutDashboard',
                    sortOrder: -10,
                    portal: 'admin',
                })
                break
            case 'employee':
                basePath = '/employee'
                menus = scanDir(path.join(appDir, 'employee'), 'employee', null, basePath)
                    .map(m => ({ ...m, code: `EMPLOYEE.${m.code}`, id: `EMPLOYEE.${m.code}` }))
                menus.unshift({
                    id: 'EMPLOYEE.DASHBOARD',
                    code: 'EMPLOYEE.DASHBOARD',
                    name: 'Dashboard',
                    parentCode: null,
                    path: '/employee',
                    icon: 'LayoutDashboard',
                    sortOrder: -10,
                    portal: 'employee',
                })
                break
            case 'finance':
                basePath = '/finance'
                menus = scanDir(path.join(appDir, 'finance'), 'finance', null, basePath)
                    .map(m => ({ ...m, code: `FINANCE_PORTAL.${m.code}`, id: `FINANCE_PORTAL.${m.code}` }))
                menus.unshift({
                    id: 'FINANCE_PORTAL.DASHBOARD',
                    code: 'FINANCE_PORTAL.DASHBOARD',
                    name: 'Dashboard',
                    parentCode: null,
                    path: '/finance',
                    icon: 'LayoutDashboard',
                    sortOrder: -10,
                    portal: 'finance',
                })
                break
        }

        return {
            data: menus,
            flat: flatten(menus),
        }
    },
    ['menu-discovery'], // Cache key
    {
        revalidate: 300, // Cache for 5 minutes (300 seconds)
        tags: ['menus'], // Can be invalidated with revalidateTag('menus')
    }
)

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const portal = searchParams.get('portal') || 'admin'

        // Get cached menus (only scans if cache expired)
        const result = await getCachedMenus(portal)

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error) {
        console.error('Error discovering menus:', error)
        return NextResponse.json(
            { error: 'Failed to discover menus' },
            { status: 500 }
        )
    }
}
