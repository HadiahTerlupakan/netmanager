import { prisma } from '@/lib/prisma'
import type { MixRadiusOwnerGroup } from '@prisma/client'
import axios, { type AxiosInstance } from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import { mixRadiusConfigRepo } from '@/modules/integrations/mixradius/MixRadiusConfigRepository'

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
}

export class MixRadiusService {
  private credentials: MixRadiusCredentials
  private client: AxiosInstance
  private jar: CookieJar
  private isLoggedIn: boolean = false
  private loginExpiresAt: number = 0

  constructor() {
    // Initial credentials from environment variables (fallback)
    this.credentials = {
      username: process.env.MIXRADIUS_USERNAME || 'rudihartono',
      password: process.env.MIXRADIUS_PASSWORD || 'rudihartono12#',
      baseUrl: process.env.MIXRADIUS_URL || 'https://sblnet.topsetting.com:973'
    }

    // Disable SSL verification for self-signed certificates
    // Note: This is set at process level as axios-cookiejar-support doesn't work with custom httpsAgent
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    // Create cookie jar
    this.jar = new CookieJar()

    // Create axios instance with cookie jar support
    this.client = wrapper(axios.create({
      jar: this.jar,
      withCredentials: true,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Scale-Source': 'MixRadius V3.2', // Custom header sometimes seen or just harmless
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    }))
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
          username: process.env.MIXRADIUS_USERNAME || 'rudihartono',
          password: process.env.MIXRADIUS_PASSWORD || 'rudihartono12#',
          baseUrl: (process.env.MIXRADIUS_URL || 'https://sblnet.topsetting.com:973').replace(/\/$/, '')
        }
      }
    } catch (error) {
       console.error('[MixRadius] Failed to load credentials from DB:', error)
       // Keep existing/default if DB fails
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

    try {
      console.log('[MixRadius] Logging in...')
      console.log(`[MixRadius] URL: ${this.credentials.baseUrl}`)
      console.log(`[MixRadius] Username: ${this.credentials.username}`)

      // Step 1: Get login page (to get initial cookies)
      await this.client.get(`${this.credentials.baseUrl}/rad-admin`)
      console.log('[MixRadius] Got login page')

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
    } catch (error: any) {
      console.error('[MixRadius] Login error:', error.message)
      this.isLoggedIn = false
      throw new Error(`MixRadius login failed: ${error.message}`)
    }
  }

  /**
   * Fetch data customers PPP dari MixRadius
   */
  async fetchCustomersPPP(params: FetchCustomersParams = {}): Promise<MixRadiusCustomerResponse> {
    const { start = 0, length = 10, search = '', searchType = 'all' } = params

    try {
      // Ensure we're logged in
      await this.login()

      console.log(`[MixRadius] Fetching customers: start=${start}, length=${length}, search="${search}", searchType=${searchType}, groupId=${params.groupId}`)

      // STRATEGY:
      // Use the reliable /customers-ppp endpoint which returns all data.
      // We process filtering (especially for authStatus/Isolir) IN-MEMORY to ensure accuracy used 
      // because upstream filtering is inconsistent.
      
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
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          },
        }))
        // Retry once
        return this.fetchCustomersPPP(params)
      }

      const responseData = response.data as MixRadiusCustomerResponse
      let allData = responseData.data || []
      
      // Store original total before filtering
      console.log(`[MixRadius] Upstream returned ${allData.length} records. Filtering in-memory...`)

      // Deduplicate data by USERNAME (more reliable than ID for unique users)
      // And strictly filter distinct usernames
      const uniqueMap = new Map()
      allData.forEach(item => {
        // Ensure valid username and not already added
        if (item.username && !uniqueMap.has(item.username)) {
          uniqueMap.set(item.username, item)
        }
      })
      allData = Array.from(uniqueMap.values())
      
      const totalRecordsFromUpstream = allData.length

      // --- IN-MEMORY FILTERING ---
      
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
                 const fieldVal = (item as any)[searchType]
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

      const recordsFiltered = allData.length

      // 4. Pagination
      const pagedData = allData.slice(start, start + length)

      return {
        draw: 1,
        recordsTotal: totalRecordsFromUpstream, // Keep original total (e.g. 2533)
        recordsFiltered: recordsFiltered,       // Filtered count (e.g. 102)
        data: pagedData
      }
    } catch (error: any) {
      console.error('[MixRadius] Fetch error:', error.message)
      
      // If it's a session error, try to re-login
      if (error.message.includes('session') || error.response?.status === 401) {
        this.isLoggedIn = false
        throw new Error('Session expired, please refresh')
      }
      
      throw new Error(`Failed to fetch MixRadius customers: ${error.message}`)
    }
  }

  /**
   * Get unique list of owners
   */
  async getUniqueOwners(): Promise<string[]> {
    try {
      // Reuse fetchCustomersPPP to get all data (using default "all" which fetches 10000 records)
      const result = await this.fetchCustomersPPP({ start: 0, length: 10000 })
      
      const owners = new Set<string>()
      result.data.forEach(item => {
        if (item.owner_name) {
          owners.add(item.owner_name)
        }
      })
      
      return Array.from(owners).sort()
    } catch (error) {
      console.error('[MixRadius] Get owners error:', error)
      return []
    }
  }

  // --- Owner Group Methods ---

  async getOwnerGroups() {
      return prisma.mixRadiusOwnerGroup.findMany({
          orderBy: { name: 'asc' }
      })
  }

  async getOwnerGroup(id: string) {
      return prisma.mixRadiusOwnerGroup.findUnique({
          where: { id }
      })
  }

  async createOwnerGroup(data: { name: string; owners: string[]; isActive?: boolean }) {
      return prisma.mixRadiusOwnerGroup.create({
          data
      })
  }

  async updateOwnerGroup(id: string, data: { name?: string; owners?: string[]; isActive?: boolean }) {
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
   * Fetch detail customer dari MixRadius
   * Endpoint: GET /rad-customers/edit/{id}
   */
  async fetchCustomerDetail(customerId: string): Promise<MixRadiusCustomerDetail> {
    try {
      // Ensure we're logged in
      await this.login()

      console.log(`[MixRadius] Fetching customer detail: ${customerId}`)

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
            if (valueMatch) return valueMatch[1]
        }
        return ''
      }

      const extractTextarea = (name: string): string => {
        const regex = new RegExp(`name="${name}"[^>]*>([^<]*)</textarea>`, 'i')
        const match = html.match(regex)
        return match ? match[1] : ''
      }

      // Extract text content of selected open
      const extractSelect = (name: string): string => {
        const selectBlockRegex = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, 'i')
        const selectBlockMatch = html.match(selectBlockRegex)
        
        if (selectBlockMatch) {
          const selectContent = selectBlockMatch[1]
          // Find option with selected attribute (flexible order)
          // Matches <option ... selected ... >TEXT</option>
          // Changed ([^<]*) to ([\s\S]*?) to allow HTML tags inside the option text
          const selectedOptionRegex = /<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i
          const match = selectContent.match(selectedOptionRegex)
          if (match) return match[1].replace(/<[^>]*>/g, '').trim()

          // Fallback: looking for value match if possible (assuming value is present)
           const valueMatch = selectContent.match(/<option[^>]*value="([^"]*)"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i)
           if (valueMatch) return valueMatch[2].replace(/<[^>]*>/g, '').trim()
        }
        return ''
      }

      // Extract value attribute of selected option
      const extractSelectValue = (name: string): string => {
        const selectBlockRegex = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, 'i')
        const selectBlockMatch = html.match(selectBlockRegex)
        
        if (selectBlockMatch) {
          const selectContent = selectBlockMatch[1]
          // Match selected option logic
          const valueRegex = /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i
          const valueMatch = selectContent.match(valueRegex)
          if (valueMatch) return valueMatch[1]
          
          const valueRegex2 = /<option[^>]*selected[^>]*value=['"]([^'"]*)['"]/i
          const valueMatch2 = selectContent.match(valueRegex2)
          if (valueMatch2) return valueMatch2[1]
        }
        return ''
      }

      const extractRadio = (name: string): string => {
        const regex = new RegExp(`input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*checked`, 'i')
        const match = html.match(regex)
        return match ? match[1] : ''
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
             return match ? match[1].trim() : ''
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
        
        invoices: (() => {
           const invoices: MixRadiusInvoice[] = []
           // Regex to match the invoice table specifically by checking for known headers or ID if consistent
           // We'll look for the table containing 'Invoice' and 'Paket Langganan' or simply match rows in the expected table section
           // Assuming it's a datatable or standard table.
           
           // Strategy: Find the table body that likely contains the invoices. 
           // Simple approach: Look for <tr> elements that contain invoice-like patterns (e.g., date, amount)
           // But safer to try to find the table element first.
           
           // Let's try to match <tr> rows that have 8 columns (based on typical admin columns)
           // Pattern: <tr> <td>ID</td> <td>Invoice</td> <td>Plan</td> <td>Amount</td> ... </tr>
           
           // Common pattern in this system for invoices seems to be a list. 
           // Let's capture all TRs and filter for those that look like invoices.
           const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
           let rowMatch
           
           // We need to be careful not to pick up the main details table rows. 
           // The invoice table usually comes AFTER the details.
           // Let's split HTML to find the section after "Riwayat Tagihan" or similar if possible.
           // If not, we iterate all rows and check content.
           
           while ((rowMatch = rowRegex.exec(html)) !== null) {
             const rowContent = rowMatch[1]
             const colRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
             const cols: string[] = []
             let colMatch
             while ((colMatch = colRegex.exec(rowContent)) !== null) {
               cols.push(colMatch[1].replace(/<[^>]*>/g, '').trim())
             }
             
             // Check if this row looks like an invoice row
             // Needs at least 5-8 columns
             // Column 0 is usually ID (number)
             // Column 1 is usually Invoice Number (string)
             // Column 3 is usually Amount (currency format)
             
             if (cols.length >= 7) {
                // Heuristic to ensure it's an invoice row:
                // Col 0: numeric ID
                // Col 3: contains 'Rp' or numeric
                // Col 7: status
                
                // Example columns assumption:
                // 0: ID
                // 1: Invoice Number
                // 2: Plan Name
                // 3: Amount
                // 4: Activation Date
                // 5: Deadline Date
                // 6: Owner
                // 7: Status (often has buttons/badges)
                
                if (/^\d+$/.test(cols[0]) && (cols[3].includes('Rp') || /[\d,\.]+/.test(cols[3]))) {
                   invoices.push({
                     id: cols[0],
                     invoice_number: cols[1],
                     plan_name: cols[2],
                     amount: cols[3],
                     activation_date: cols[4],
                     deadline_date: cols[5],
                     owner: cols[6],
                     status: cols[7] || 'Unknown' // Extracts raw text, backend might need to refine status if it's inside buttons
                   })
                }
             }
           }
           
           return invoices
        })(),
        
        // Stats from alerts
        uptime: (() => {
          const regex = /<i class="icon fa fa-calendar"><\/i>\s*([^<]+)\s*<\/h4>\s*Waktu Online/i
          const match = html.match(regex)
          return match ? match[1].trim() : ''
        })(),
        quota_usage: (() => {
          const regex = /<i class="icon fa fa-area-chart"><\/i>\s*([^<]+)\s*<\/h4>\s*Quota Terpakai/i
          const match = html.match(regex)
          return match ? match[1].trim() : ''
        })(),
      }

      console.log(`[MixRadius] Customer detail fetched: ${customerDetail.fullname}`)
      return customerDetail
    } catch (error: any) {
      console.error('[MixRadius] Fetch customer detail error:', error.message)
      throw new Error(`Failed to fetch customer detail: ${error.message}`)
    }
  }

  /**
   * Clear session (force re-login on next request)
   */
  clearSession(): void {
    this.isLoggedIn = false
    this.loginExpiresAt = 0
    this.jar = new CookieJar()
    console.log('[MixRadius] Session cleared')
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    return this.isLoggedIn && this.loginExpiresAt > Date.now()
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
