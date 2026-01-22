/**
 * MixRadius Integration Service
 * 
 * Service untuk mengambil data pelanggan PPP dari sistem MixRadius eksternal.
 * Menggunakan axios dengan cookie jar support untuk automatic session management.
 */

import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'

// Types
export interface MixRadiusCredentials {
  username: string
  password: string
  baseUrl: string
}

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
}

export interface FetchCustomersParams {
  start?: number
  length?: number
  search?: string
  searchType?: string // all, member_id, username, fullname, phonenumber, address
}

export class MixRadiusService {
  private credentials: MixRadiusCredentials
  private client: AxiosInstance
  private jar: CookieJar
  private isLoggedIn: boolean = false
  private loginExpiresAt: number = 0

  constructor() {
    // Load credentials from environment variables
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
   * Login ke MixRadius
   */
  async login(): Promise<void> {
    // Check if already logged in and not expired
    if (this.isLoggedIn && this.loginExpiresAt > Date.now()) {
      console.log('[MixRadius] Already logged in, using existing session')
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

      console.log(`[MixRadius] Fetching customers: start=${start}, length=${length}, search="${search}", searchType=${searchType}`)

      // Build form data for DataTables request
      const formData = new URLSearchParams()
      formData.append('draw', '1')
      formData.append('start', start.toString())
      formData.append('length', Math.min(length, 100).toString())
      
      // Column definitions for DataTables
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
        { data: 'auth_status', searchable: false },
        { data: 'note', searchable: true },
        { data: 'phonenumber', searchable: true },
      ]

      // Add column definitions
      columns.forEach((col, idx) => {
        formData.append(`columns[${idx}][data]`, col.data)
        formData.append(`columns[${idx}][name]`, '')
        formData.append(`columns[${idx}][searchable]`, col.searchable ? 'true' : 'false')
        formData.append(`columns[${idx}][orderable]`, 'true')
        formData.append(`columns[${idx}][search][value]`, '')
        formData.append(`columns[${idx}][search][regex]`, 'false')
      })

      // Set search - either global or per-column
      if (searchType === 'all') {
        // Global search
        formData.append('search[value]', search)
        formData.append('search[regex]', 'false')
      } else {
        // Per-column search
        formData.append('search[value]', '')
        formData.append('search[regex]', 'false')
        
        // Map searchType to column index
        const columnMap: Record<string, number> = {
          'member_id': 1,
          'username': 2,
          'fullname': 3,
          'address': 4,
          'phonenumber': 13,
        }
        
        const colIdx = columnMap[searchType]
        if (colIdx !== undefined) {
          // Update the column search value
          formData.set(`columns[${colIdx}][search][value]`, search)
        }
      }

      // Add ordering (by renewed_on desc)
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

      const data = response.data as MixRadiusCustomerResponse
      console.log(`[MixRadius] Fetched ${data.data?.length || 0} customers (total: ${data.recordsTotal || 0})`)

      return data
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
        const regex = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i')
        const match = html.match(regex)
        return match ? match[1] : ''
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
          const selectedOptionRegex = /<option[^>]*selected[^>]*>([^<]*)<\/option>/i
          const selectedOptionMatch = selectContent.match(selectedOptionRegex)
          
          if (selectedOptionMatch) {
             return selectedOptionMatch[1].replace(/<[^>]*>/g, '').trim()
          }
        }
        return ''
      }

      // Extract value attribute of selected option
      const extractSelectValue = (name: string): string => {
        const selectBlockRegex = new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, 'i')
        const selectBlockMatch = html.match(selectBlockRegex)
        
        if (selectBlockMatch) {
          const selectContent = selectBlockMatch[1]
          // Match option with selected attribute and capture its value
          const valueRegex = /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i
          const valueMatch = selectContent.match(valueRegex)
          if (valueMatch) return valueMatch[1]
          
          // Alternative order: selected before value
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
        mac_address: extractValue('callerid'), 
        total: '', 
        latitude: extractValue('latitude'),
        longitude: extractValue('longitude'),
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
