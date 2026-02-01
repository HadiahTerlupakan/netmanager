import { prisma } from '@/lib/prisma'
import type { MixRadiusOwnerGroup } from '@prisma/client'
import axios, { type AxiosInstance } from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import { mixRadiusConfigRepo } from '@/modules/integrations/repositories/MixRadiusConfigRepository'
import { LRUCache } from '@/lib/utils/lru-cache'

// Types
export interface MixRadiusCredentials {
  username: string
  password: string
  baseUrl: string
}

export type { MixRadiusOwnerGroup }

export interface MixRadiusCustomer {
  id: string
  type: string
  member_id: string
  servicetype: string
  nasporttype: string
  server_name: string | null
  method: string
  username: string
  password: string
  fullname: string
  email: string
  phonenumber: string
  address: string
  created_at: string
  plan_name: string
  total: string | number
  renewed_on: string
  expired_on: string
  remote_address: string
  note: string | null
  trx_invoice: string
  trx_status: string
  payment_type: string
  auth_status: string
  bind_mac: string
  mac_address: string | null
  owner_name: string
  // New fields for online status
  online?: boolean
  active_session_ip?: string
}

export interface MixRadiusCustomerResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: MixRadiusCustomer[]
}

export interface MixRadiusCustomerDetail {
  id: string
  member_id: string
  username: string
  password: string
  fullname: string
  email: string
  phonenumber: string
  address: string
  remote_address: string
  plan_name: string
  payment_type: string
  subscription_type: string
  trx_status: string
  identity_number: string
  created_at: string
  renewed_on: string
  expired_on: string
  auth_status: string
  note: string
  bind_mac: string
  mac_address: string
  total: string
  latitude: string
  longitude: string
  // Extended fields
  odp_name?: string
  owner_name?: string
  service_type?: string
  ip_type?: string
  portal_password?: string
  expired_action?: string
  uptime?: string
  quota_usage?: string
  online?: boolean
  invoices?: MixRadiusInvoice[]
}

export interface MixRadiusInvoice {
  id: string
  invoice_number: string
  plan_name: string
  amount: string
  activation_date: string
  deadline_date: string
  owner: string
  status: string
}

export interface FetchCustomersParams {
  start?: number
  length?: number
  search?: string
  searchType?: string // all, member_id, username, fullname, phonenumber, address
  authStatus?: string
  ownerName?: string
  groupId?: string
  onlineStatus?: 'online' | 'offline'
  siteId?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  forceRefresh?: boolean
}

// ODP Types for Topology Map
export interface MixRadiusODP {
  id: string
  name: string
  area: string
  latitude: number
  longitude: number
  ownerName: string
  customerCount?: number
}

export interface MixRadiusODPCustomer {
  id: string
  memberId: string
  fullname: string
  address: string
  planName: string
  ownerName: string
  odpId: string
  odpName: string
  latitude: number
  longitude: number
}

export interface MixRadiusTopologyData {
  odps: MixRadiusODP[]
  customers: MixRadiusODPCustomer[]
}

export class MixRadiusService {
  private credentials: MixRadiusCredentials
  private client: AxiosInstance
  private jar: CookieJar
  private isLoggedIn: boolean = false
  private loginExpiresAt: number = 0
  private invoiceCountCache: LRUCache<string, { paidCount: number, totalCount: number, lastRenewedOn: string }>

  // Cache for Customers List - 2 minutes TTL
  // Reduces load significantly when sorting, filtering, or paginating locally
  private customersCache: {
    data: MixRadiusCustomer[]
    expiresAt: number
  } = { data: [], expiresAt: 0 }
  private static CUSTOMERS_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

  // Topology cache - 5 minutes TTL (data doesn't change frequently)
  private topologyCache: {
    data: MixRadiusTopologyData | null
    expiresAt: number
    ownerFilter: string | null
  } = { data: null, expiresAt: 0, ownerFilter: null }
  private static TOPOLOGY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Initial credentials from environment variables (fallback)
    this.credentials = {
      username: process.env.MIXRADIUS_USERNAME || '',
      password: process.env.MIXRADIUS_PASSWORD || '',
      baseUrl: process.env.MIXRADIUS_URL || ''
    }

    // Note: MixRadius server now has valid SSL certificate from Sectigo (*.topsetting.com)
    // No need to disable TLS verification anymore

    // Create cookie jar
    this.jar = new CookieJar()

    // Initialize cache - 5000 items (covers all customers), 24 hours TTL
    this.invoiceCountCache = new LRUCache(5000, 24 * 3600 * 1000)

    // Create axios instance with cookie jar support
    this.client = wrapper(axios.create({
      jar: this.jar,
      withCredentials: true,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    }))
  }

  /**
   * Human-like random delay
   * Helps avoid bot detection and reduces server hammering
   */
  private async randomDelay(min: number = 300, max: number = 800): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1) + min)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Load credentials from DB or fallback to Env
   */
  private async loadCredentials() {
    try {
      const activeConfig = await mixRadiusConfigRepo.getActiveConfig()
      if (activeConfig) {
        console.log(`[MixRadius] Using active config from DB: ${activeConfig.name}`)
        this.credentials = {
          username: activeConfig.username,
          password: activeConfig.password,
          baseUrl: activeConfig.baseUrl.replace(/\/$/, ''),
        }
      } else {
        console.log('[MixRadius] No active config in DB, using fallback Env vars')
        // Fallback to env (already set in constructor, but ensuring update if needed)
        this.credentials = {
          username: process.env.MIXRADIUS_USERNAME || '',
          password: process.env.MIXRADIUS_PASSWORD || '',
          baseUrl: (process.env.MIXRADIUS_URL || '').replace(/\/$/, '')
        }
        
        if (!this.credentials.username || !this.credentials.password || !this.credentials.baseUrl) {
             console.warn('[MixRadius] Credentials missing in Env vars. MixRadius integration will fail until configured.');
        }
      }
    } catch (_error) {
       // Silent failure for credential loading, will be caught by login() validation
    }
  }

  /**
   * Login ke MixRadius
   */
  async login(): Promise<void> {
    // Check if already logged in and not expired
    if (this.isLoggedIn && this.loginExpiresAt > Date.now()) {
      // Logic for session re-use, but maybe config changed? 
      // Strictly speaking if config changes we should re-login.
      // But for performance let's assume session is valid until expired or error.
      // Or we can check if credentials match current implementation.
      // For now, simple approach:
      // console.log('[MixRadius] Already logged in, using existing session')
      // return
    }

    // Always reload credentials to ensure we use the latest Active config
    await this.loadCredentials()
    
    // Check session again against NEW credentials? 
    // If username/url changed, we MUST re-login.
    // For simplicity, just re-login if forced or expired. 
    // But to respect "Active" switch, we should probably force login if previous session was different.
    // However, existing "isLoggedIn" doesn't track which config was used.
    // Let's assume if we call login, we want to ensure session is valid for CURRENT credentials.

    // If we are logged in, check if BaseURL matches current credentials?
    // Hard to check. Let's just proceed with login.
    // Optimization: if isLoggedIn and not expired, assume it's okay unless explicit "change account" action happened. 
    // But user might switch account in admin.
    // If user switch account, they might trigger this. 
    // We'll trust the caller OR just always re-check.
    
    if (this.isLoggedIn && this.loginExpiresAt > Date.now()) {
        // We could store which username we are logged in as.
        // For now, risk of stale session if account switched rapidly. 
        // But usually "getActiveConfig" call above updates local this.credentials.
        // If we want to be safe, we reset `isLoggedIn` if we detect config change. 
        // Let's keep it simple: If valid, return. If 401 later, it will retry.
        // But if config CHANGED in DB, old session might effectively be valid for OLD server, but we want NEW server.
        // Safe bet: If implementing multi-account, maybe force login or check context.
        // IMPROVEMENT: On `loadCredentials`, if credentials differ from cached, invalidate session.
        // Since `loadCredentials` is called here, I can't check diff easily without storage.
        // Let's just rely on expiry for now since I don't store `lastUsedCredentials`.
        
        console.log('[MixRadius] Using existing session')
        return
    }

    // Check for missing configuration
    if (!this.credentials.baseUrl || !this.credentials.baseUrl.startsWith('http')) {
      console.warn('[MixRadius] Invalid or missing Base URL')
      throw new Error('URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.')
    }

    if (!this.credentials.username || !this.credentials.password) {
      console.warn('[MixRadius] Missing credentials')
      throw new Error('Username atau Password MixRadius belum dikonfigurasi.')
    }

    try {
      console.log('[MixRadius] Logging in...')
      console.log(`[MixRadius] URL: ${this.credentials.baseUrl}`)
      console.log(`[MixRadius] Username: ${this.credentials.username}`)

      // Step 1: Get login page (to get initial cookies)
      await this.client.get(`${this.credentials.baseUrl}/rad-admin`)
      console.log('[MixRadius] Got login page')

      // Simulate human typing delay
      await this.randomDelay(800, 2000)

      // Step 2: Submit login form
      const formData = new URLSearchParams({
        username: this.credentials.username,
        password: this.credentials.password
      })

      const loginResponse = await this.client.post(
        `${this.credentials.baseUrl}/rad-admin/post`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.credentials.baseUrl}/rad-admin`,
            'Origin': this.credentials.baseUrl,
          },
          maxRedirects: 5, // Follow redirects
        }
      )

      console.log(`[MixRadius] Login response status: ${loginResponse.status}`)
      console.log(`[MixRadius] Login response URL: ${loginResponse.request?.res?.responseUrl || 'N/A'}`)

      // Check if login was successful by checking if we're redirected to dashboard
      const responseUrl = loginResponse.request?.res?.responseUrl || ''
      if (responseUrl.includes('dashboard') || loginResponse.status === 200) {
        this.isLoggedIn = true
        // Set expiry to 50 minutes (session expires in 1 hour)
        this.loginExpiresAt = Date.now() + (50 * 60 * 1000)
        console.log('[MixRadius] Login successful!')
      } else {
        throw new Error('Login may have failed - unexpected response')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Login error:', message)
      this.isLoggedIn = false
      throw new Error(`MixRadius login failed: ${message}`)
    }
  }

  /**
   * Fetch data customers PPP dari MixRadius
   */
  async fetchCustomersPPP(params: FetchCustomersParams = {}): Promise<MixRadiusCustomerResponse> {
    const { start = 0, length = 10, search = '', searchType = 'all', sortBy = 'expired_on', sortDir = 'asc', forceRefresh = false } = params

    try {
      // Ensure we're logged in
      try {
        await this.login()
      } catch (loginError) {
        const errorMsg = loginError instanceof Error ? loginError.message : String(loginError)
        // If it's a configuration error, return empty data instead of crashing
        if (errorMsg.includes('konfigurasi') || errorMsg.includes('valid')) {
           console.warn(`[MixRadius] Integration not available: ${errorMsg}`)
           return {
             draw: 1,
             recordsTotal: 0,
             recordsFiltered: 0,
             data: []
           }
        }
        throw loginError
      }

      console.log(`[MixRadius] Fetching customers: start=${start}, length=${length}, search="${search}", searchType=${searchType}, groupId=${params.groupId}`)

      // STRATEGY:
      // Use the reliable /customers-ppp endpoint which returns all data.
      // We process filtering (especially for authStatus/Isolir) IN-MEMORY to ensure accuracy used
      // because upstream filtering is inconsistent.

      let allData: MixRadiusCustomer[] = []

      // Check Cache First (Skip if forceRefresh is true)
      if (!forceRefresh && this.customersCache.data.length > 0 && this.customersCache.expiresAt > Date.now()) {
        console.log(`[MixRadius] Using cached customer list (${this.customersCache.data.length} records). Expires in ${Math.round((this.customersCache.expiresAt - Date.now())/1000)}s`)
        allData = [...this.customersCache.data] // Use copy
      } else {
        if (forceRefresh) {
            console.log('[MixRadius] Force refresh requested. Bypassing cache...')
        } else {
            console.log('[MixRadius] Cache miss/expired. Fetching fresh data from upstream...')
        }

        // Add a small random delay before big fetch
        await this.randomDelay(500, 1500)

        const formData = new URLSearchParams()
        formData.append('draw', '1')
        formData.append('start', '0') // Always request from 0 to get full dataset
        formData.append('length', '10000') // Request large chunk to cover all users

        // Column definitions (Standard for customers-ppp which we know works)
        const columns = [
          { data: 'id', searchable: false },
          { data: 'member_id', searchable: true },
          { data: 'username', searchable: true },
          { data: 'fullname', searchable: true },
          { data: 'address', searchable: true },
          { data: 'nasporttype', searchable: false },
          { data: 'plan_name', searchable: true },
          { data: 'remote_address', searchable: false },
          { data: 'renewed_on', searchable: true },
          { data: 'expired_on', searchable: true },
          { data: 'owner_name', searchable: true },
          { data: 'auth_status', searchable: true },
          { data: 'note', searchable: true },
          { data: 'phonenumber', searchable: true },
        ]

        columns.forEach((col, idx) => {
          formData.append(`columns[${idx}][data]`, col.data)
          formData.append(`columns[${idx}][name]`, '')
          formData.append(`columns[${idx}][searchable]`, col.searchable ? 'true' : 'false')
          formData.append(`columns[${idx}][orderable]`, 'true')
          formData.append(`columns[${idx}][search][value]`, '')
          formData.append(`columns[${idx}][search][regex]`, 'false')
        })

        // Global search empty to upstream
        formData.append('search[value]', '')
        formData.append('search[regex]', 'false')

        formData.append('order[0][column]', '8')
        formData.append('order[0][dir]', 'desc')

        const response = await this.client.post(
          `${this.credentials.baseUrl}/rad-get-data/customers-ppp`,
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Origin': this.credentials.baseUrl,
              'Referer': `${this.credentials.baseUrl}/rad-customers/ppp`,
            },
          }
        )

        // Check if we got HTML instead of JSON (session expired)
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
          console.log('[MixRadius] Session expired, clearing and retrying...')
          this.isLoggedIn = false
          this.jar = new CookieJar()
          // Recreate client with new jar
          this.client = wrapper(axios.create({
            jar: this.jar,
            withCredentials: true,
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          }))
          // Retry once
          return this.fetchCustomersPPP(params)
        }

        const responseData = response.data as MixRadiusCustomerResponse
        let rawData = responseData.data || []

        console.log(`[MixRadius] Upstream returned ${rawData.length} records. Filtering in-memory...`)

        // Deduplicate data by USERNAME (more reliable than ID for unique users)
        const uniqueMap = new Map()
        rawData.forEach(item => {
          if (item.username && !uniqueMap.has(item.username)) {
            uniqueMap.set(item.username, item)
          }
        })

        // Update Cache
        allData = Array.from(uniqueMap.values())
        this.customersCache = {
          data: allData,
          expiresAt: Date.now() + MixRadiusService.CUSTOMERS_CACHE_TTL
        }
      }

      const totalRecordsFromUpstream = allData.length


      // 0. Filter by Management Site
      if (params.siteId) {
        // Find owner groups for this site
        const groups = await prisma.mixRadiusOwnerGroup.findMany({
          where: { siteId: params.siteId },
          select: { owners: true }
        })
        
        // Flatten all owners from these groups
        const allowedOwners = new Set(groups.flatMap(g => g.owners))
        
        // Filter customers who belong to any of these owners
        allData = allData.filter(item => allowedOwners.has(item.owner_name))
      }

      // 1. Filter by Expired (Jatuh Tempo) - Strict Request
      // "Yang belum jatuh tempo mah gak usah ditampilkan"
      if (params.authStatus && params.authStatus === 'Disabled-Users') {
        const now = new Date()
        allData = allData.filter(item => {
          if (!item.expired_on) return false
          
          const expDate = new Date(item.expired_on)
          if (isNaN(expDate.getTime())) return false
          
          // Strict: Must be expired
          return expDate < now
        })
      } else if (params.authStatus) {
        // Normal filtering for other statuses if any
        allData = allData.filter(item => item.auth_status === params.authStatus)
      }

      // 2. Filter by Search (Global or Column)
      if (search) {
        const lowerSearch = search.toLowerCase()
        if (searchType === 'all') {
             // Global search across relevant fields including OWNER
             allData = allData.filter(item => 
                 (item.fullname && item.fullname.toLowerCase().includes(lowerSearch)) ||
                 (item.username && item.username.toLowerCase().includes(lowerSearch)) ||
                 (item.member_id && item.member_id.toLowerCase().includes(lowerSearch)) ||
                 (item.address && item.address.toLowerCase().includes(lowerSearch)) ||
                 (item.phonenumber && item.phonenumber.toLowerCase().includes(lowerSearch)) ||
                 (item.owner_name && item.owner_name.toLowerCase().includes(lowerSearch))
             )
        } else {
             // Specific column search
             allData = allData.filter(item => {
                 const fieldVal = (item as unknown as Record<string, unknown>)[searchType]
                 return fieldVal && String(fieldVal).toLowerCase().includes(lowerSearch)
             })
        }
      }

      // 3. Filter by Owner OR Group
      if (params.groupId) {
          // Fetch group owners
          const group = await prisma.mixRadiusOwnerGroup.findUnique({
              where: { id: params.groupId },
              select: { owners: true }
          })
          
          if (group && group.owners && group.owners.length > 0) {
              const allowedOwners = new Set(group.owners)
              allData = allData.filter(item => item.owner_name && allowedOwners.has(item.owner_name))
          } else if (group && (!group.owners || group.owners.length === 0)) {
              // Group exists but no owners - return empty or all? Strictly empty if filtering by group
              allData = []
          }
      } else if (params.ownerName) {
         // Fallback to single owner filter if provided
         allData = allData.filter(item => item.owner_name === params.ownerName)
      }

      // const recordsFiltered = allData.length

      // FETCH ACTIVE SESSIONS and MERGE
      let activeSessions = new Map<string, { ip: string; uptime: string }>();
      try {
        // Active sessions also changes frequently, but we can respect cache if desired.
        // However, user usually wants live status.
        // We can add a very short cache (10s) to active sessions or keep it live.
        // Let's keep it live but add delay
        await this.randomDelay(100, 300)
        activeSessions = await this.fetchActiveSessionsPPP()
      } catch (_err) {
        // console.error("Active session fetch failed", err);
      }

      // Merge online status
      let onlineCount = 0
      allData = allData.map((customer) => {
        const session = activeSessions.get(customer.username)
        if (session) onlineCount++

        return {
          ...customer,
          online: !!session,
          active_session_ip: session ? session.ip : undefined
        }
      })
      console.log(`[MixRadius] Merged online status. Total online from ${allData.length} records: ${onlineCount}`)

      // 4. Online Status Filtering
      if (params.onlineStatus) {
        const isOnline = params.onlineStatus === 'online'
        allData = allData.filter(item => item.online === isOnline)
        console.log(`[MixRadius] Filtered by onlineStatus: ${params.onlineStatus}. Remaining: ${allData.length}`)
      }

      const recordsFilteredCount = allData.length

      // 5. Sorting
      if (sortBy) {
        allData.sort((a, b) => {
          // Type-safe property access
          const key = sortBy as keyof MixRadiusCustomer
          const valA = a[key]
          const valB = b[key]

          // Handle dates specifically
          if (sortBy === 'expired_on' || sortBy === 'renewed_on' || sortBy === 'created_at') {
             const dateA = valA ? new Date(String(valA)).getTime() : 0
             const dateB = valB ? new Date(String(valB)).getTime() : 0
             return sortDir === 'asc' ? dateA - dateB : dateB - dateA
          }

          // Handle string comparison
          const strA = String(valA || '').toLowerCase()
          const strB = String(valB || '').toLowerCase()

          if (strA < strB) return sortDir === 'asc' ? -1 : 1
          if (strA > strB) return sortDir === 'asc' ? 1 : -1
          return 0
        })
      } else if (params.authStatus === 'Disabled-Users') {
        // Default sort for Disabled Users (Old logic kept as fallback if no sortBy provided)
        allData.sort((a, b) => {
          const dateA = a.expired_on ? new Date(a.expired_on).getTime() : 0
          const dateB = b.expired_on ? new Date(b.expired_on).getTime() : 0
          return dateA - dateB // Ascending: oldest first
        })
      }

      // 6. Pagination
      const pagedData = allData.slice(start, start + length)

      return {
        draw: 1,
        recordsTotal: totalRecordsFromUpstream, // Keep original total (e.g. 2533)
        recordsFiltered: recordsFilteredCount,  // Filtered count
        data: pagedData
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Fetch error:', message)

      // If it's a session error, try to re-login
      if (message.includes('session') || (error as { response?: { status: number } }).response?.status === 401) {
        this.isLoggedIn = false
        throw new Error('Session expired, please refresh')
      }

      throw new Error(`Failed to fetch MixRadius customers: ${message}`)
    }
  }

  /**
   * Get unique list of owners
   */
  async getUniqueOwners(): Promise<string[]> {
    try {
      // Reuse fetchCustomersPPP to get all data (using default "all" which fetches 10000 records)
      const result = await this.fetchCustomersPPP({ start: 0, length: 10000 })
      
      if (!result.data || result.data.length === 0) {
        return []
      }

      const owners = new Set<string>()
      result.data.forEach(item => {
        if (item.owner_name) {
          owners.add(item.owner_name)
        }
      })
      
      return Array.from(owners).sort()
    } catch (error) {
      console.error('[MixRadius] Get owners error:', error instanceof Error ? error.message : error)
      return []
    }
  }

  // --- Owner Group Methods ---

  async getOwnerGroups() {
      return prisma.mixRadiusOwnerGroup.findMany({
          orderBy: { name: 'asc' },
          include: { site: true }
      })
  }

  async getOwnerGroup(id: string) {
      return prisma.mixRadiusOwnerGroup.findUnique({
          where: { id },
          include: { site: true }
      })
  }

  async createOwnerGroup(data: { name: string; owners: string[]; siteId?: string; isActive?: boolean }) {
      return prisma.mixRadiusOwnerGroup.create({
          data
      })
  }

  async updateOwnerGroup(id: string, data: { name?: string; owners?: string[]; siteId?: string; isActive?: boolean }) {
      return prisma.mixRadiusOwnerGroup.update({
          where: { id },
          data
      })
  }

  async deleteOwnerGroup(id: string) {
      return prisma.mixRadiusOwnerGroup.delete({
          where: { id }
      })
  }

  /**
   * Fetch Active Sessions from MixRadius
   * Endpoint: /rad-get-active-sessions (or similar, verifying via implementation)
   * Returns: Map of username -> session info
   */
  async fetchActiveSessionsPPP(): Promise<Map<string, { ip: string, uptime: string }>> {
    try {
      if (!this.isLoggedIn) await this.login()

      console.log('[MixRadius] Fetching active sessions...')

      // Standard DataTables request params for Active Sessions
      // Based on typical MixRadius admin panel network requests
      const formData = new URLSearchParams()
      formData.append('draw', '1')
      formData.append('start', '0')
      formData.append('length', '5000') // Fetch max to get all online users
      formData.append('search[value]', '')
      formData.append('search[regex]', 'false')

      // Add delay
      await this.randomDelay(200, 500)

      const response = await this.client.post(
        `${this.credentials.baseUrl}/rad-get-data/active-ppp&sid=SSP-38`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': `${this.credentials.baseUrl}/rad-users-session/active-ppp`
          }
        }
      )

      const activeMap = new Map<string, { ip: string, uptime: string }>()
      
      if (response.data && Array.isArray(response.data.data)) {
        // data usually contains: [id, username, ip_address, start_time, update_time, ... ]
        // OR objects if modern. Let's assume typical MixRadius object array or check log.
        // Usually objects with 'username', 'framedipaddress', 'acctstarttime'
        
        const sessions = response.data.data
        console.log(`[MixRadius] Found ${sessions.length} active sessions`)
        if (sessions.length > 0) {
            console.log('[MixRadius] First session sample:', JSON.stringify(sessions[0], null, 2))
        }
        
        sessions.forEach((session: Record<string, unknown>) => {
          // Normalize fields based on NEW JSON structure:
          // username, nasshortname, acctsessionid, acctsessiontime, acctstarttime, calledstationid, callingstationid, framedipaddress, acctinputoctets, acctoutputoctets, member_id, fullname, expired_on, plan_name, owner_name, type, method
          const username = String(session.username || session.member_id || '')
          const ip = String(session.framedipaddress || '')
          const uptime = String(session.acctsessiontime || '')
          
          if (username) {
            activeMap.set(username, { ip, uptime })
          }
        })
      }

      return activeMap
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Failed to fetch active sessions:', message)
      // Return empty map instead of failing entire request
      return new Map()
    }
  }

  /**
   * Fetch Invoice Counts for a list of Customer IDs
   * Uses parallel fetching of details (limit batch size in caller)
   * bypassCache: force re-fetch
   * validationData: map of customerId -> currentRenewedOn to auto-invalidate stale cache
   */
  async fetchInvoiceCounts(
    customerIds: string[], 
    bypassCache: boolean = false,
    validationData: Record<string, string> = {}
  ): Promise<Map<string, { paidCount: number, totalCount: number }>> {
    if (!this.isLoggedIn) await this.login()
    
    const results = new Map<string, { paidCount: number, totalCount: number }>()
    
    // Process one by one to be extremely polite to MixRadius (Limit: 1 concurrent)
    const chunkSize = 1
    for (let i = 0; i < customerIds.length; i += chunkSize) {
      const chunk = customerIds.slice(i, i + chunkSize)
      
      const promises = chunk.map(async (id) => {
        try {
          // Check cache first (skip if bypassCache is true)
          if (!bypassCache) {
            const cached = this.invoiceCountCache.get(id)
            const liveRenewedOn = validationData[id]
            
            // SMART INVALIDATION: Re-fetch if live date is different from cached date
            if (cached && (!liveRenewedOn || cached.lastRenewedOn === liveRenewedOn)) {
              results.set(id, { paidCount: cached.paidCount, totalCount: cached.totalCount })
              return
            }
          }

          console.log(`[MixRadius] Cache MISS for invoice count customer ${id}. Fetching detail...`)

          // Random delay to avoid pattern detection
          await this.randomDelay(300, 1000)

          const detail = await this.fetchCustomerDetail(id)
          const invoices = detail.invoices || []
          
          const paidCount = invoices.filter(inv => inv.status === 'Paid').length
          const totalCount = invoices.length
          const lastRenewedOn = validationData[id] || detail.renewed_on || ''
          
          const counts = { paidCount, totalCount }
          results.set(id, counts)
          this.invoiceCountCache.set(id, { ...counts, lastRenewedOn })
        } catch (error) {
          console.error(`[MixRadius] Failed to fetch invoice count for ${id}:`, error)
          results.set(id, { paidCount: 0, totalCount: 0 })
        }
      })

      // Wait for CURRENT chunk to complete before starting next
      await Promise.all(promises)

      // Random pause between chunks
      if (i + chunkSize < customerIds.length) {
        await this.randomDelay(200, 500)
      }
    }
    return results
  }

  /**
   * Helper to parse invoices from HTML table
   */
  private parseInvoicesFromHtml(html: string): MixRadiusInvoice[] {
    const invoices: MixRadiusInvoice[] = []
    
    // Find table rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch
    
    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const rowContent = rowMatch[1] ?? ''
        const colRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
        const cols: string[] = []
        let colMatch
        while ((colMatch = colRegex.exec(rowContent)) !== null) {
          cols.push((colMatch[1] ?? '').replace(/<[^>]*>/g, '').trim())
        }
        
        if (cols.length >= 7) {
           let status = cols[7] || ''
           const rowUpper = rowContent.toUpperCase()
           
           if (!status || status === 'Unknown' || status.trim() === '') {
              if (rowUpper.includes('UNPAID') || rowUpper.includes('BELUM BAYAR')) status = 'Unpaid'
              else if (rowUpper.includes('PAID') || rowUpper.includes('LUNAS')) status = 'Paid'
              else status = 'Unknown'
           }

           let invoiceNum = cols[1] ?? ''
           if (invoiceNum.toUpperCase().endsWith('UNPAID')) {
               invoiceNum = invoiceNum.substring(0, invoiceNum.length - 6)
               if (!status || status === 'Unknown') status = 'Unpaid'
           } else if (invoiceNum.toUpperCase().endsWith('PAID')) {
               invoiceNum = invoiceNum.substring(0, invoiceNum.length - 4)
               if (!status || status === 'Unknown') status = 'Paid'
           }

           const col0 = cols[0] ?? ''
           const col3 = cols[3] ?? ''

           if (/^\d+$/.test(col0) && (col3.includes('Rp') || /[\d,\.]+/.test(col3))) {
              invoices.push({
                id: col0,
                invoice_number: invoiceNum,
                plan_name: cols[2] ?? '',
                amount: col3,
                activation_date: cols[4] ?? '',
                deadline_date: cols[5] ?? '',
                owner: cols[6] ?? '',
                status: status
              })
           }
        }
    }
    return invoices
  }

  /**
   * Fetch detail customer dari MixRadius
   * Endpoint: GET /rad-customers/edit/{id}
   */
  async fetchCustomerDetail(customerId: string): Promise<MixRadiusCustomerDetail> {
    try {
      // Ensure we're logged in
      await this.login()

      console.log(`[MixRadius] Fetching customer detail: ${customerId}`)

      // Random delay
      await this.randomDelay(200, 600)

      const response = await this.client.get(
        `${this.credentials.baseUrl}/rad-customers/edit/${customerId}`,
        {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': `${this.credentials.baseUrl}/rad-customers/ppp`,
          },
        }
      )

      // Parse HTML response to extract customer data
      const html = response.data as string
      
      // Check if we got login page (session expired)
      if (html.includes('LOGIN</title>') || html.includes('rad-admin/post')) {
        this.isLoggedIn = false
        throw new Error('Session expired, please refresh')
      }

      // Scraping Canary: Verify we are on the correct page by checking for known headers or unique markers
      // MixRadius usually has an "Edit Customer" or similar title and common icons
      const hasCorrectHeader = /<h4>\s*<i[^>]*class="[^"]*fa-edit[^"]*"[^>]*><\/i>[\s\S]*?(Edit|Detail)[\s\S]*?<\/h4>/i.test(html) || 
                               (html.includes('id_plan') && html.includes('username'))
      
      if (!hasCorrectHeader) {
          console.warn(`[MixRadius] Page structure check failed for customer ${customerId}. Marker elements not found.`)
          // We'll still try to proceed, but if core fields fail later, the existing check will catch it.
      }

      // Extract customer data from HTML form fields
      const extractValue = (name: string): string => {
        // Find input tag with specific name
        const inputTagRegex = new RegExp(`<input[^>]*name="${name}"[^>]*>`, 'i')
        const inputMatch = html.match(inputTagRegex)
        
        if (inputMatch) {
            const inputTag = inputMatch[0]
            // Extract value attribute from the found tag
            const valueRegex = /value=['"]([^'"]*)['"]/i
            const valueMatch = inputTag.match(valueRegex)
            if (valueMatch) return valueMatch[1] ?? ''
        }
        return ''
      }

      const extractTextarea = (name: string): string => {
        const regex = new RegExp(`name="${name}"[^>]*>([^<]*)</textarea>`, 'i')
        const match = html.match(regex)
        return match ? match[1] ?? '' : ''
      }

      // Extract text content of selected open
      const extractSelect = (name: string): string => {
        const selectBlockRegex = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, 'i')
        const selectBlockMatch = html.match(selectBlockRegex)

        if (selectBlockMatch) {
          const selectContent = selectBlockMatch[1] ?? ''
          // Find option with selected attribute (flexible order)
          // Matches <option ... selected ... >TEXT</option>
          // Changed ([^<]*) to ([\s\S]*?) to allow HTML tags inside the option text
          const selectedOptionRegex = /<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i
          const match = selectContent.match(selectedOptionRegex)
          if (match) return (match[1] ?? '').replace(/<[^>]*>/g, '').trim()

          // Fallback: looking for value match if possible (assuming value is present)
           const valueMatch = selectContent.match(/<option[^>]*value="([^"]*)"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i)
           if (valueMatch) return (valueMatch[2] ?? '').replace(/<[^>]*>/g, '').trim()
        }
        return ''
      }

      // Extract value attribute of selected option
      const extractSelectValue = (name: string): string => {
        const selectBlockRegex = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, 'i')
        const selectBlockMatch = html.match(selectBlockRegex)

        if (selectBlockMatch) {
          const selectContent = selectBlockMatch[1] ?? ''
          // Match selected option logic
          const valueRegex = /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i
          const valueMatch = selectContent.match(valueRegex)
          if (valueMatch) return valueMatch[1] ?? ''

          const valueRegex2 = /<option[^>]*selected[^>]*value=['"]([^'"]*)['"]/i
          const valueMatch2 = selectContent.match(valueRegex2)
          if (valueMatch2) return valueMatch2[1] ?? ''
        }
        return ''
      }

      const extractRadio = (name: string): string => {
        const regex = new RegExp(`input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*checked`, 'i')
        const match = html.match(regex)
        return match ? match[1] ?? '' : ''
      }

      // Handle specific field names from HTML
      const customerDetail: MixRadiusCustomerDetail = {
        id: customerId,
        member_id: extractValue('memberId'), // Note: HTML uses memberId, not member_id
        username: extractValue('username'),
        password: extractValue('password'),
        fullname: extractValue('fullname'),
        email: extractValue('email'),
        phonenumber: extractValue('phonenumber'),
        address: extractTextarea('address'),
        remote_address: extractValue('remote_address') || 'Automatic',
        
        // Plan extraction - text is better for display
        plan_name: extractSelect('id_plan'), 
        
        // Enum values are better for logic
        payment_type: extractSelectValue('payment_type') || 'POSTPAID',
        subscription_type: extractRadio('subscription_type') || 'regular',
        trx_status: extractSelectValue('trx_status') || 'UNPAID',
        
        identity_number: extractValue('identity_number'),
        
        created_at: '', 
        renewed_on: extractValue('renewed_on'),
        expired_on: extractValue('expired_on'),
        
        auth_status: extractSelectValue('account_status') === 'enabled' ? 'Enabled-Users' : 'Disabled-Users',
        
        note: extractValue('note'), 
        bind_mac: extractSelectValue('bindmac'),
        // Try callerid input first, fallback to sniffing the fa-server icon section which often holds the MAC
        mac_address: extractValue('callerid') || (() => {
             const regex = /<i class="icon fa fa-server"><\/i>\s*([0-9A-Fa-f:]{12,17})/i
             const match = html.match(regex)
             return match ? (match[1] ?? '').trim() : ''
        })(),
        total: '',
        latitude: extractValue('latitude'),
        longitude: extractValue('longitude'),

        // Extended fields
        odp_name: extractSelect('odp_id'),
        owner_name: extractSelect('owner').replace(/^Saat ini\s*:\s*/i, ''),
        service_type: extractSelect('nasporttype'),
        ip_type: extractSelect('ip_address_type'),
        portal_password: extractValue('portalpassword'),
        expired_action: extractSelect('expired_action'),

        invoices: this.parseInvoicesFromHtml(html),



        // Stats from alerts
        online: /Perangkat\s*\(\s*<b>\s*online\s*<\/b>\s*\)/i.test(html),
        uptime: (() => {
          const regex = /<i class="icon fa fa-calendar"><\/i>\s*([^<]+)\s*<\/h4>\s*Waktu Online/i
          const match = html.match(regex)
          return match ? (match[1] ?? '').trim() : ''
        })(),
        quota_usage: (() => {
          const regex = /<i class="icon fa fa-area-chart"><\/i>\s*([^<]+)\s*<\/h4>\s*Quota Terpakai/i
          const match = html.match(regex)
          return match ? (match[1] ?? '').trim() : ''
        })(),
      }

      console.log(`[MixRadius] Customer detail fetched: ${customerDetail.fullname}`)
      
      // Canary check: Validation for scraping robustness
      // If we got a 200 OK but fail to find username OR member_id, the HTML layout likely changed.
      if (!customerDetail.username && !customerDetail.member_id) {
          // Log the HTML snippet for debugging (truncate for safety)
          console.error(`[MixRadius] Scraping Validation Failed for ID ${customerId}. HTML snippet: ${html.substring(0, 500)}...`)
          throw new Error('Integration Error: MixRadius Admin Panel layout may have changed. Failed to extract core customer data.')
      }

      return customerDetail
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Fetch customer detail error:', message)
      throw new Error(`Failed to fetch customer detail: ${message}`)
    }
  }

  /**
   * Clear session (force re-login on next request)
   */
  async clearSession(): Promise<void> {
    this.isLoggedIn = false
    this.loginExpiresAt = 0
    this.customersCache = { data: [], expiresAt: 0 } // Clear local cache too
    this.jar = new CookieJar()
    console.log('[MixRadius] Session and caches cleared')
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    return this.isLoggedIn && this.loginExpiresAt > Date.now()
  }

  // ==================== ODP Methods for Topology Map ====================

  /**
   * Parse DMS (Degrees Minutes Seconds) to Decimal
   * Example: "6°32'56.3" → 6.5489722...
   * Note: MixRadius stores lat as positive but represents South latitude
   */
  private parseDMSToDecimal(dms: string): number | null {
    if (!dms) return null
    
    // Clean up HTML entities and various quote formats
    const cleaned = dms
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/'/g, "'")  // Unicode right single quotation mark
      .replace(/'/g, "'")  // Unicode left single quotation mark
      .replace(/′/g, "'")  // Prime symbol
      .replace(/″/g, '"')  // Double prime symbol
    
    // Try to match DMS format: 6°32'56.3 or 107°48'03.1
    // Also handle formats like 6°32'56.3" (with trailing double quote)
    const dmsRegex = /(-?)(\d+)[°](\d+)['](\d+\.?\d*)["'"]?/
    const match = cleaned.match(dmsRegex)
    
    if (match) {
      const sign = match[1] === '-' ? -1 : 1
      const degrees = parseFloat(match[2] ?? '0')
      const minutes = parseFloat(match[3] ?? '0')
      const seconds = parseFloat(match[4] ?? '0')

      const result = sign * (degrees + minutes / 60 + seconds / 3600)
      return result
    }
    
    // Try parsing as decimal directly
    const decimal = parseFloat(cleaned)
    if (!isNaN(decimal)) return decimal
    
    console.warn(`[MixRadius] Could not parse DMS: "${dms}" -> "${cleaned}"`)
    return null
  }

  /**
   * Parse Google Maps place URL to extract coordinates
   * Example: "https://www.google.com/maps/place/6°32'56.6,107°48'02.5"
   */
  private parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
    if (!url) return null
    
    // Clean up HTML entities
    const cleaned = url
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
    
    // Match pattern: /maps/place/LAT,LNG
    // LAT and LNG can contain °, ', " and numbers
    // The pattern ends at a space, end of string, or closing quote/tag
    const placeRegex = /maps\/place\/([^,]+),([^<>\s"]+)/
    const match = cleaned.match(placeRegex)
    
    if (match) {
      const latStr = match[1] ?? ''
      const lngStr = match[2] ?? ''

      const lat = this.parseDMSToDecimal(latStr)
      const lng = this.parseDMSToDecimal(lngStr)
      
      if (lat !== null && lng !== null) {
        // MixRadius stores latitude as positive but it's actually South (negative)
        // Check if this is Indonesian coords (should be negative latitude)
        return { 
          lat: lat > 0 && lat < 15 ? -lat : lat, // Indonesian latitude is negative
          lng 
        }
      } else {
        console.warn(`[MixRadius] Failed to parse coords: lat="${latStr}" -> ${lat}, lng="${lngStr}" -> ${lng}`)
      }
    } else {
      console.warn(`[MixRadius] No coordinate match in URL: ${url.substring(0, 100)}`)
    }
    
    return null
  }

  /**
   * Fetch list of ODPs from MixRadius
   * Endpoint: GET /rad-autoload/mapping-odps/ALL (JSON API - much faster!)
   */
  async fetchODPList(): Promise<MixRadiusODP[]> {
    try {
      await this.login()

      console.log('[MixRadius] Fetching ODP list via mapping API...')

      await this.randomDelay(300, 800)

      const response = await this.client.get(
        `${this.credentials.baseUrl}/rad-autoload/mapping-odps/ALL`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Referer': `${this.credentials.baseUrl}/rad-odp/mapping`,
          },
        }
      )

      // Check if session expired (returned HTML login page)
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.log('[MixRadius] Session expired during ODP fetch, retrying...')
        this.isLoggedIn = false
        return this.fetchODPList()
      }

      // Parse JSON if response is string
      let data = response.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (e) {
          console.error('[MixRadius] Failed to parse ODP mapping response:', e)
          return []
        }
      }

      if (!Array.isArray(data)) {
        console.log('[MixRadius] ODP mapping response is not an array')
        return []
      }

      console.log(`[MixRadius] Found ${data.length} ODPs from mapping API`)

      const odps: MixRadiusODP[] = []

      for (const item of data) {
        // Parse latitude - check DMS format FIRST (contains ° symbol)
        let lat: number
        const latStr = String(item.odp_latitude || '')
        if (latStr.includes('°')) {
          lat = this.parseDMSToDecimal(latStr) || 0
        } else {
          lat = parseFloat(latStr) || 0
        }
        
        // Parse longitude - check DMS format FIRST (contains ° symbol)
        let lng: number
        const lngStr = String(item.odp_longitude || '')
        if (lngStr.includes('°')) {
          lng = this.parseDMSToDecimal(lngStr) || 0
        } else {
          lng = parseFloat(lngStr) || 0
        }

        // Skip if no valid coordinates
        if (lat === 0 && lng === 0) {
          continue
        }

        // Fix Indonesian latitude (should be negative)
        if (lat > 0 && lat < 15) {
          lat = -lat
        }

        // Validate coordinates are within Indonesia bounds
        // Indonesia: lat -11 to 6, lng 95 to 141
        const isValidCoord = lat >= -12 && lat <= 8 && lng >= 94 && lng <= 142
        if (!isValidCoord) {
          console.warn(`[MixRadius] ODP ${item.odp_name} has invalid coords: lat=${lat}, lng=${lng}`)
          continue
        }

        odps.push({
          id: String(item.id), // Ensure ID is always a string
          name: item.odp_name || '',
          area: item.odp_area || '',
          latitude: lat,
          longitude: lng,
          ownerName: item.owner_name || '',
          customerCount: parseInt(item.customers_count || '0', 10),
        })
      }

      console.log(`[MixRadius] Parsed ${odps.length} ODPs with valid coordinates`)
      return odps
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Fetch ODP list error:', message)
      throw new Error(`Failed to fetch ODP list: ${message}`)
    }
  }

  /**
   * Fetch customers for a specific ODP
   * Endpoint: GET /rad-odp/edit/{id} (parse HTML tab Pelanggan)
   */
  async fetchODPCustomers(odpId: string): Promise<MixRadiusODPCustomer[]> {
    try {
      await this.login()

      console.log(`[MixRadius] Fetching customers for ODP ${odpId}...`)

      await this.randomDelay(200, 500)

      const response = await this.client.get(
        `${this.credentials.baseUrl}/rad-odp/edit/${odpId}`,
        {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': `${this.credentials.baseUrl}/rad-odp/list`,
          },
        }
      )

      const html = response.data as string

      // Check if session expired
      if (html.includes('LOGIN</title>') || html.includes('rad-admin/post')) {
        this.isLoggedIn = false
        return this.fetchODPCustomers(odpId)
      }

      // Extract ODP name
      const odpNameMatch = html.match(/name="name"[^>]*value="([^"]+)"/i)
      const odpName = odpNameMatch?.[1] ?? `ODP-${odpId}`

      // Parse customers from table in tab "Pelanggan"
      const customers: MixRadiusODPCustomer[] = []
      
      // Find the customers table (id="dynamic-table")
      const tableMatch = html.match(/<table[^>]*id="dynamic-table"[^>]*>([\s\S]*?)<\/table>/i)
      if (!tableMatch) {
        console.log(`[MixRadius] No customer table found for ODP ${odpId}`)
        return customers
      }

      const tableContent = tableMatch[1] ?? ''

      // Parse each row in tbody
      const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi
      let rowMatch

      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowHtml = rowMatch[1] ?? ''

        // Skip header rows
        if (rowHtml.includes('<th>')) continue

        // Extract cells
        const cells: string[] = []
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
        let cellMatch

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          cells.push(cellMatch[1] ?? '')
        }
        
        if (cells.length >= 7) {
          // Extract customer ID from checkbox
          const cell0 = cells[0] ?? ''
          const idMatch = cell0.match(/value="(\d+)"/)
          const customerId = idMatch ? idMatch[1] : ''

          // Extract coordinates from Google Maps link
          const cell6 = cells[6] ?? ''
          const mapsLinkMatch = cell6.match(/href="([^"]*google\.com\/maps[^"]*)"/i)
          const coords = mapsLinkMatch ? this.parseGoogleMapsCoords(mapsLinkMatch[1] ?? '') : null

          if (customerId && coords) {
            // Validate coordinates are within Indonesia bounds
            // Indonesia: lat -11 to 6, lng 95 to 141
            const isValidCoord = coords.lat >= -12 && coords.lat <= 8 &&
                                 coords.lng >= 94 && coords.lng <= 142

            if (isValidCoord) {
              customers.push({
                id: customerId,
                memberId: (cells[1] ?? '').replace(/<[^>]*>/g, '').trim(),
                fullname: (cells[2] ?? '').replace(/<[^>]*>/g, '').trim(),
                address: (cells[3] ?? '').replace(/<[^>]*>/g, '').trim(),
                planName: (cells[4] ?? '').replace(/<[^>]*>/g, '').trim(),
                ownerName: (cells[5] ?? '').replace(/<[^>]*>/g, '').trim(),
                odpId: String(odpId), // Ensure ID is always a string
                odpName: odpName,
                latitude: coords.lat,
                longitude: coords.lng,
              })
            } else {
              console.warn(`[MixRadius] Invalid coords for customer ${customerId}: lat=${coords.lat}, lng=${coords.lng}`)
            }
          }
        }
      }

      console.log(`[MixRadius] Found ${customers.length} customers for ODP ${odpId}`)
      return customers
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[MixRadius] Fetch ODP customers error for ${odpId}:`, message)
      return [] // Return empty instead of throwing to continue with other ODPs
    }
  }

  /**
   * Clear topology cache (call this when ODP/customer data changes)
   */
  clearTopologyCache(): void {
    this.topologyCache = { data: null, expiresAt: 0, ownerFilter: null }
    console.log('[MixRadius] Topology cache cleared')
  }

  /**
   * Fetch all topology data (ODPs + Customers) for the map
   * Uses parallel batching for faster customer fetching
   * Results are cached for 5 minutes
   */
  async fetchTopologyData(options?: { ownerName?: string, forceRefresh?: boolean }): Promise<MixRadiusTopologyData> {
    try {
      const ownerFilter = options?.ownerName || null
      
      // Check cache (if not force refresh and cache is valid)
      if (!options?.forceRefresh && 
          this.topologyCache.data && 
          this.topologyCache.expiresAt > Date.now() &&
          this.topologyCache.ownerFilter === ownerFilter) {
        console.log('[MixRadius] Using cached topology data')
        return this.topologyCache.data
      }
      
      console.log('[MixRadius] Fetching topology data (cache miss or expired)...')
      
      // Get all ODPs (mapping API includes customer counts)
      let odps = await this.fetchODPList()
      
      // Filter by owner if specified
      if (options?.ownerName) {
        odps = odps.filter(odp => odp.ownerName === options.ownerName)
      }

      // Only fetch customers for ODPs that have customers (customerCount > 0)
      const odpsWithCustomers = odps.filter(odp => (odp.customerCount || 0) > 0)
      console.log(`[MixRadius] Fetching customers for ${odpsWithCustomers.length} ODPs (with customers)...`)

      // Fetch customers in parallel batches (3 concurrent requests to avoid server overload)
      const BATCH_SIZE = 3
      const allCustomers: MixRadiusODPCustomer[] = []
      
      for (let i = 0; i < odpsWithCustomers.length; i += BATCH_SIZE) {
        const batch = odpsWithCustomers.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (odp) => {
            try {
              return await this.fetchODPCustomers(odp.id)
            } catch (_error) {
              console.error(`[MixRadius] Failed to fetch customers for ODP ${odp.id}`)
              return []
            }
          })
        )
        batchResults.forEach(customers => allCustomers.push(...customers))
        
        // Random pause between batches
        if (i + BATCH_SIZE < odpsWithCustomers.length) {
          await this.randomDelay(500, 1500)
        }
      }

      console.log(`[MixRadius] Topology data complete: ${odps.length} ODPs, ${allCustomers.length} customers`)

      const result: MixRadiusTopologyData = {
        odps,
        customers: allCustomers,
      }
      
      // Update cache
      this.topologyCache = {
        data: result,
        expiresAt: Date.now() + MixRadiusService.TOPOLOGY_CACHE_TTL,
        ownerFilter: ownerFilter
      }
      console.log(`[MixRadius] Topology data cached (expires in 5 minutes)`)
      
      return result
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MixRadius] Fetch topology data error:', message)
      throw new Error(`Failed to fetch topology data: ${message}`)
    }
  }
}

// Singleton instance
let mixRadiusServiceInstance: MixRadiusService | null = null

export function getMixRadiusService(): MixRadiusService {
  if (!mixRadiusServiceInstance) {
    mixRadiusServiceInstance = new MixRadiusService()
  }
  return mixRadiusServiceInstance
}
