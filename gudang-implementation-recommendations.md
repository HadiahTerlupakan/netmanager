# Rekomendasi Implementasi Teknis Menu Gudang

## 1. Arsitektur Teknis

### 1.1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Mobile    │  │   Tablet    │  │   Desktop   │    │
│  │   View      │  │   View      │  │   View      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Application Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Auth     │  │   State     │  │   API       │    │
│  │  Middleware │  │ Management  │  │   Client    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   API       │  │  Business   │  │   Data      │    │
│  │  Endpoints  │  │   Logic     │  │  Access     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ PostgreSQL  │  │    Redis    │  │ File Storage│    │
│  │ Database    │  │    Cache    │  │   System    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2. Technology Stack

#### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + useState/useReducer
- **UI Components**: Custom components + Headless UI
- **Form Handling**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API with custom hooks
- **Icons**: React Icons (Hi2)
- **Mobile PWA**: Service Worker + Web App Manifest

#### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Validation**: Zod
- **File Upload**: Multer + Sharp for image processing
- **Caching**: Redis
- **Logging**: Winston

#### Infrastructure
- **Deployment**: Docker containers
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **File Storage**: Local filesystem + CDN for static assets
- **Monitoring**: Application logs + performance metrics

## 2. Component Architecture

### 2.1. Folder Structure

```
app/
├── employee/
│   ├── warehouse/
│   │   ├── page.tsx                    # Main warehouse page
│   │   ├── components/
│   │   │   ├── TabNavigation.tsx       # Tab switcher
│   │   │   ├── AmbilTab/
│   │   │   │   ├── AmbilForm.tsx       # Take item form
│   │   │   │   ├── StockInfo.tsx       # Stock display
│   │   │   │   ├── RiwayatAmbil.tsx    # Borrow history
│   │   │   │   └── index.ts           # Exports
│   │   │   └── KembaliTab/
│   │   │       ├── DaftarPinjaman.tsx   # Borrowed items list
│   │   │       ├── KembaliForm.tsx      # Return form
│   │   │       ├── RiwayatKembali.tsx   # Return history
│   │   │       └── index.ts           # Exports
│   │   └── hooks/
│   │       ├── useWarehouseData.ts      # Data fetching hook
│   │       ├── useBorrowedItems.ts     # Borrowed items hook
│   │       └── useReturnForm.ts        # Return form hook
│   └── layout.tsx                      # Employee layout
├── api/
│   └── inventory/
│       ├── employee/
│       │   ├── items/
│       │   │   └── route.ts           # Get borrowed items
│       │   ├── history/
│       │   │   └── route.ts           # Get transaction history
│       │   ├── stats/
│       │   │   └── route.ts           # Get employee stats
│       │   └── return/
│       │       └── route.ts           # Process return
│       ├── keluar/
│       │   └── route.ts               # Enhanced existing
│       └── masuk/
│           └── route.ts               # Enhanced existing
└── components/
    ├── inventory/
    │   ├── ItemCard.tsx               # Reusable item card
    │   ├── PhotoUpload.tsx            # Photo upload component
    │   ├── StockIndicator.tsx         # Stock level indicator
    │   ├── TransactionHistory.tsx      # Transaction history list
    │   └── index.ts                  # Exports
    └── ui/
        ├── Button.tsx                 # Enhanced button
        ├── Card.tsx                  # Card component
        ├── Form.tsx                  # Form components
        ├── Input.tsx                 # Input components
        ├── Loading.tsx               # Loading states
        └── index.ts                  # Exports
```

### 2.2. Component Design Patterns

#### 1. Compound Component Pattern
```typescript
// components/inventory/WarehouseForm.tsx
interface WarehouseFormProps {
  children: React.ReactNode
  onSubmit: (data: FormData) => void
  loading?: boolean
}

function WarehouseForm({ children, onSubmit, loading }: WarehouseFormProps) {
  return (
    <form onSubmit={onSubmit} className="warehouse-form">
      {children}
    </form>
  )
}

WarehouseForm.Field = Field
WarehouseForm.Select = Select
WarehouseForm.Textarea = Textarea
WarehouseForm.Button = Button

// Usage
<WarehouseForm onSubmit={handleSubmit}>
  <WarehouseForm.Select name="barang" label="Pilih Barang" />
  <WarehouseForm.Field name="jumlah" label="Jumlah" type="number" />
  <WarehouseForm.Button type="submit">Submit</WarehouseForm.Button>
</WarehouseForm>
```

#### 2. Render Props Pattern
```typescript
// components/inventory/TabNavigation.tsx
interface TabNavigationProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void
  renderContent: (activeTab: string) => React.ReactNode
}

function TabNavigation({ tabs, activeTab, onTabChange, renderContent }: TabNavigationProps) {
  return (
    <div className="tab-navigation">
      <div className="tab-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={activeTab === tab.id ? 'active' : ''}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {renderContent(activeTab)}
      </div>
    </div>
  )
}
```

#### 3. Custom Hook Pattern
```typescript
// hooks/useWarehouseData.ts
interface UseWarehouseDataReturn {
  borrowedItems: BorrowedItem[]
  loading: boolean
  error: string | null
  refetch: () => void
  mutate: (data: any) => void
}

function useWarehouseData(): UseWarehouseDataReturn {
  const [data, setData] = useState<BorrowedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null)
  
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/inventory/employee/items')
      const result = await response.json()
      setData(result.data.borrowedItems)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const mutate = useCallback(async (newData: any) => {
    // Optimistic update
    setData(prev => [...prev, newData])
    // API call
    // Revert on error
  }, [])
  
  useEffect(() => {
    refetch()
  }, [refetch])
  
  return { borrowedItems: data, loading, error, refetch, mutate }
}
```

## 3. State Management Strategy

### 3.1. Global State (Context)

```typescript
// contexts/WarehouseContext.tsx
interface WarehouseContextType {
  activeTab: 'ambil' | 'kembali'
  setActiveTab: (tab: 'ambil' | 'kembali') => void
  borrowedItems: BorrowedItem[]
  returnHistory: Transaction[]
  refreshData: () => Promise<void>
  loading: boolean
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'ambil' | 'kembali'>('ambil')
  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([])
  const [returnHistory, setReturnHistory] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  
  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, historyRes] = await Promise.all([
        fetch('/api/inventory/employee/items'),
        fetch('/api/inventory/employee/history')
      ])
      
      const itemsData = await itemsRes.json()
      const historyData = await historyRes.json()
      
      setBorrowedItems(itemsData.data.borrowedItems)
      setReturnHistory(historyData.data.transactions)
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    refreshData()
  }, [refreshData])
  
  return (
    <WarehouseContext.Provider value={{
      activeTab,
      setActiveTab,
      borrowedItems,
      returnHistory,
      refreshData,
      loading
    }}>
      {children}
    </WarehouseContext.Provider>
  )
}

export function useWarehouse() {
  const context = useContext(WarehouseContext)
  if (!context) {
    throw new Error('useWarehouse must be used within WarehouseProvider')
  }
  return context
}
```

### 3.2. Local State (Component)

```typescript
// components/inventory/AmbilForm.tsx
function AmbilForm() {
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    jumlah: '',
    purpose: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch('/api/inventory/keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        // Reset form
        setFormData({ barangId: '', gudangId: '', jumlah: '', purpose: '' })
        setPhotos([])
        // Refresh data
        await refreshData()
      } else {
        const error = await response.json()
        setErrors({ submit: error.error })
      }
    } catch (error) {
      setErrors({ submit: 'Terjadi kesalahan. Silakan coba lagi.' })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="ambil-form">
      {/* Form fields */}
    </form>
  )
}
```

## 4. Performance Optimization

### 4.1. Code Splitting

```typescript
// Dynamic imports for better performance
import dynamic from 'next/dynamic'

const AmbilTab = dynamic(() => import('./components/AmbilTab'), {
  loading: () => <div>Loading...</div>,
  ssr: false
})

const KembaliTab = dynamic(() => import('./components/KembaliTab'), {
  loading: () => <div>Loading...</div>,
  ssr: false
})

// Main warehouse page
export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState('ambil')
  
  return (
    <div className="warehouse-page">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'ambil' && <AmbilTab />}
      {activeTab === 'kembali' && <KembaliTab />}
    </div>
  )
}
```

### 4.2. Data Fetching Optimization

```typescript
// hooks/useInfiniteScroll.ts
function useInfiniteScroll<T>(
  fetchFunction: (page: number) => Promise<T[]>,
  initialPage: number = 1
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(initialPage)
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    
    setLoading(true)
    try {
      const newData = await fetchFunction(page)
      setData(prev => [...prev, ...newData])
      setPage(prev => prev + 1)
      setHasMore(newData.length > 0)
    } catch (error) {
      console.error('Failed to load more data:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchFunction, page, loading, hasMore])
  
  return { data, loading, hasMore, loadMore }
}

// Usage in transaction history
function TransactionHistory() {
  const { data, loading, hasMore, loadMore } = useInfiniteScroll(
    async (page) => {
      const response = await fetch(`/api/inventory/employee/history?page=${page}`)
      const result = await response.json()
      return result.data.transactions
    }
  )
  
  return (
    <div className="transaction-history">
      {data.map(transaction => (
        <TransactionCard key={transaction.id} transaction={transaction} />
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
```

### 4.3. Memoization Strategy

```typescript
// components/inventory/ItemCard.tsx
import { memo } from 'react'

interface ItemCardProps {
  item: BorrowedItem
  onReturn: (itemId: string) => void
  onViewDetails: (itemId: string) => void
}

const ItemCard = memo(({ item, onReturn, onViewDetails }: ItemCardProps) => {
  return (
    <div className="item-card">
      <h3>{item.barangNama}</h3>
      <p>Jumlah: {item.jumlah}</p>
      <div className="item-actions">
        <button onClick={() => onViewDetails(item.id)}>Details</button>
        <button onClick={() => onReturn(item.id)}>Return</button>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.isReturned === nextProps.item.isReturned
  )
})

export default ItemCard
```

## 5. Security Implementation

### 5.1. Authentication & Authorization

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    
    // Protect employee routes
    if (pathname.startsWith('/employee/warehouse')) {
      const token = req.nextauth.token
      
      if (!token) {
        return NextResponse.redirect(new URL('/employee/login', req.url))
      }
      
      // Check role-based access
      if (token.role !== 'EMPLOYEE' && token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }
    
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: ['/employee/warehouse/:path*']
}
```

### 5.2. Input Validation

```typescript
// lib/validation.ts
import { z } from 'zod'

export const borrowItemSchema = z.object({
  barangId: z.string().min(1, 'Barang harus dipilih'),
  gudangId: z.string().min(1, 'Gudang harus dipilih'),
  jumlah: z.number()
    .min(1, 'Jumlah minimal 1')
    .max(1000, 'Jumlah maksimal 1000'),
  purpose: z.string()
    .min(5, 'Keperluan minimal 5 karakter')
    .max(500, 'Keperluan maksimal 500 karakter')
})

export const returnItemSchema = z.object({
  keluarId: z.string().min(1, 'Transaksi harus dipilih'),
  barangId: z.string().min(1, 'Barang harus valid'),
  gudangId: z.string().min(1, 'Gudang harus valid'),
  jumlah: z.number()
    .min(1, 'Jumlah minimal 1')
    .max(1000, 'Jumlah maksimal 1000'),
  kondisi: z.enum(['BAIK', 'RUSAK', 'HILANG'], {
    errorMap: () => ({ message: 'Kondisi tidak valid' })
  }),
  keterangan: z.string()
    .max(500, 'Keterangan maksimal 500 karakter')
    .optional(),
  fotoBukti: z.array(z.string().url())
    .max(3, 'Maksimal 3 foto')
    .optional()
})

// API route validation
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (request: Request): Promise<T> => {
    const body = await request.json()
    return schema.parse(body)
  }
}
```

### 5.3. Rate Limiting

```typescript
// lib/rateLimit.ts
import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'

interface RateLimitConfig {
  windowMs: number
  max: number
  message?: string
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  '/api/inventory/return': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many return requests. Please try again later.'
  },
  '/api/inventory/keluar': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many borrow requests. Please try again later.'
  }
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; reset?: number }> {
  const ip = request.ip ?? 'anonymous'
  const key = `rate_limit:${ip}:${request.nextUrl.pathname}`
  
  const current = await redis.get(key)
  const count = current ? parseInt(current) : 0
  
  if (count >= config.max) {
    const ttl = await redis.ttl(key)
    return { success: false, reset: Date.now() + ttl * 1000 }
  }
  
  if (count === 0) {
    await redis.setex(key, Math.ceil(config.windowMs / 1000), '1')
  } else {
    await redis.incr(key)
  }
  
  return { success: true }
}

// Usage in API route
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, rateLimitConfigs['/api/inventory/return'])
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: rateLimitConfigs['/api/inventory/return'].message },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitConfigs['/api/inventory/return'].max.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset?.toString() || ''
        }
      }
    )
  }
  
  // Process request...
}
```

## 6. Testing Strategy

### 6.1. Unit Testing

```typescript
// __tests__/components/AmbilForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AmbilForm } from '@/components/inventory/AmbilForm'
import { mockBarangs, mockGudangs } from '@/__mocks__/inventory'

describe('AmbilForm', () => {
  beforeEach(() => {
    fetch.mockResponseOnce(JSON.stringify({ 
      success: true, 
      data: { barangs: mockBarangs, gudangs: mockGudangs } 
    }))
  })
  
  test('renders form fields correctly', () => {
    render(<AmbilForm />)
    
    expect(screen.getByLabelText('Pilih Barang')).toBeInTheDocument()
    expect(screen.getByLabelText('Pilih Gudang')).toBeInTheDocument()
    expect(screen.getByLabelText('Jumlah')).toBeInTheDocument()
    expect(screen.getByLabelText('Keperluan')).toBeInTheDocument()
  })
  
  test('validates required fields', async () => {
    render(<AmbilForm />)
    
    const submitButton = screen.getByRole('button', { name: 'Ambil Barang' })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Barang harus dipilih')).toBeInTheDocument()
      expect(screen.getByText('Gudang harus dipilih')).toBeInTheDocument()
      expect(screen.getByText('Jumlah harus diisi')).toBeInTheDocument()
      expect(screen.getByText('Keperluan harus diisi')).toBeInTheDocument()
    })
  })
  
  test('submits form with valid data', async () => {
    fetch.mockResponseOnce(JSON.stringify({ 
      success: true, 
      message: 'Barang berhasil diambil' 
    }))
    
    render(<AmbilForm />)
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Pilih Barang'), { 
      target: { value: 'barang_1' } 
    })
    fireEvent.change(screen.getByLabelText('Pilih Gudang'), { 
      target: { value: 'gudang_1' } 
    })
    fireEvent.change(screen.getByLabelText('Jumlah'), { 
      target: { value: '5' } 
    })
    fireEvent.change(screen.getByLabelText('Keperluan'), { 
      target: { value: 'Untuk testing' } 
    })
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Ambil Barang' })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory/keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barangId: 'barang_1',
          gudangId: 'gudang_1',
          jumlah: 5,
          purpose: 'Untuk testing'
        })
      })
    })
  })
})
```

### 6.2. Integration Testing

```typescript
// __tests__/api/inventory/return.test.ts
import { createMocks } from 'node-mocks-http'
import { POST } from '@/app/api/inventory/return/route'
import { prisma } from '@/lib/prisma'

describe('/api/inventory/return', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  test('processes valid return transaction', async () => {
    const mockKeluar = {
      id: 'keluar_1',
      barangId: 'barang_1',
      gudangId: 'gudang_1',
      jumlah: 5,
      employeeId: 'employee_1',
      isReturned: false
    }
    
    const mockMasuk = {
      id: 'masuk_1',
      barangId: 'barang_1',
      gudangId: 'gudang_1',
      jumlah: 5,
      isReturnTransaction: true,
      returnReferenceId: 'keluar_1'
    }
    
    prisma.barangKeluar.findUnique.mockResolvedValue(mockKeluar)
    prisma.barangMasuk.create.mockResolvedValue(mockMasuk)
    prisma.barangGudang.findUnique.mockResolvedValue({ stok: 45 })
    prisma.barangGudang.update.mockResolvedValue({ stok: 50 })
    prisma.barangKeluar.update.mockResolvedValue({ isReturned: true })
    
    const { req } = createMocks({
      method: 'POST',
      body: {
        keluarId: 'keluar_1',
        barangId: 'barang_1',
        gudangId: 'gudang_1',
        jumlah: 5,
        kondisi: 'BAIK',
        keterangan: 'Tidak digunakan'
      }
    })
    
    req.auth = { user: { id: 'employee_1', role: 'EMPLOYEE' } }
    
    const response = await POST(req)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.masukId).toBe('masuk_1')
    expect(prisma.barangMasuk.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barangId: 'barang_1',
        gudangId: 'gudang_1',
        jumlah: 5,
        kondisi: 'BAIK',
        keterangan: 'Tidak digunakan',
        isReturnTransaction: true,
        returnReferenceId: 'keluar_1',
        employeeId: 'employee_1'
      })
    })
  })
  
  test('rejects return for non-owner', async () => {
    const mockKeluar = {
      id: 'keluar_1',
      employeeId: 'employee_2', // Different employee
      isReturned: false
    }
    
    prisma.barangKeluar.findUnique.mockResolvedValue(mockKeluar)
    
    const { req } = createMocks({
      method: 'POST',
      body: {
        keluarId: 'keluar_1',
        barangId: 'barang_1',
        gudangId: 'gudang_1',
        jumlah: 5,
        kondisi: 'BAIK'
      }
    })
    
    req.auth = { user: { id: 'employee_1', role: 'EMPLOYEE' } }
    
    const response = await POST(req)
    const data = await response.json()
    
    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Tidak memiliki akses ke transaksi ini')
  })
})
```

### 6.3. E2E Testing

```typescript
// e2e/warehouse.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Warehouse Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as employee
    await page.goto('/employee/login')
    await page.fill('[name="email"]', 'employee@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('[type="submit"]')
    await page.waitForURL('/employee')
  })
  
  test('should display warehouse page with tabs', async ({ page }) => {
    await page.goto('/employee/warehouse')
    
    // Check tabs are present
    await expect(page.locator('[data-testid="tab-ambil"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-kembali"]')).toBeVisible()
    
    // Check default tab is active
    await expect(page.locator('[data-testid="tab-ambil"]')).toHaveClass(/active/)
  })
  
  test('should allow borrowing items', async ({ page }) => {
    await page.goto('/employee/warehouse')
    
    // Select item
    await page.selectOption('[data-testid="select-barang"]', 'Kabel LAN CAT 6')
    
    // Select warehouse
    await page.selectOption('[data-testid="select-gudang"]', 'Gudang Utama')
    
    // Fill quantity
    await page.fill('[data-testid="input-jumlah"]', '5')
    
    // Fill purpose
    await page.fill('[data-testid="textarea-purpose"]', 'Untuk testing')
    
    // Submit form
    await page.click('[data-testid="btn-ambil"]')
    
    // Check success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Barang berhasil diambil')
  })
  
  test('should allow returning items', async ({ page }) => {
    await page.goto('/employee/warehouse')
    
    // Switch to return tab
    await page.click('[data-testid="tab-kembali"]')
    
    // Wait for borrowed items to load
    await page.waitForSelector('[data-testid="borrowed-item"]')
    
    // Click return button on first item
    await page.click('[data-testid="btn-return"]:first-child')
    
    // Fill return form
    await page.selectOption('[data-testid="select-kondisi"]', 'BAIK')
    await page.fill('[data-testid="textarea-keterangan"]', 'Tidak digunakan')
    
    // Submit return
    await page.click('[data-testid="btn-kembali"]')
    
    // Check success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Barang berhasil dikembalikan')
  })
})
```

## 7. Deployment Strategy

### 7.1. Environment Configuration

```typescript
// .env.local
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/netmanager"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="5242880" // 5MB

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000" // 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"

# Logging
LOG_LEVEL="info"
LOG_FILE="./logs/app.log"
```

### 7.2. Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/netmanager
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=netmanager
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 7.3. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Warehouse Feature

on:
  push:
    branches: [main]
    paths: ['app/employee/warehouse/**', 'app/api/inventory/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
      - run: npm run lint
      - run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Build Docker image
        run: docker build -t netmanager-warehouse .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push netmanager-warehouse

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deployment script
          ssh user@server "docker pull netmanager-warehouse && docker-compose up -d"
```

## 8. Monitoring & Maintenance

### 8.1. Application Monitoring

```typescript
// lib/monitoring.ts
import { createPrometheusMetrics } from 'prom-client'

const metrics = createPrometheusMetrics()

export const warehouseMetrics = {
  borrowRequests: metrics.counter('warehouse_borrow_requests_total', 'Total borrow requests'),
  returnRequests: metrics.counter('warehouse_return_requests_total', 'Total return requests'),
  activeUsers: metrics.gauge('warehouse_active_users', 'Active users'),
  responseTime: metrics.histogram('warehouse_response_time_seconds', 'Response time'),
  errorRate: metrics.counter('warehouse_errors_total', 'Total errors', ['error_type'])
}

// Middleware for metrics collection
export function metricsMiddleware(req: Request, res: Response, next: Function) {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    
    if (req.url?.includes('/api/inventory/')) {
      warehouseMetrics.responseTime.observe(duration)
      
      if (res.statusCode >= 400) {
        warehouseMetrics.errorRate.inc({ error_type: res.statusCode.toString() })
      }
    }
  })
  
  next()
}
```

### 8.2. Error Tracking

```typescript
// lib/errorTracking.ts
import { logger } from '@/lib/logger'

export class WarehouseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: any
  ) {
    super(message)
    this.name = 'WarehouseError'
  }
}

export function handleWarehouseError(error: Error, req: Request) {
  logger.error('Warehouse error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers.get('user-agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  })
  
  if (error instanceof WarehouseError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && { context: error.context })
    }
  }
  
  return {
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  }
}
```

### 8.3. Health Checks

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      storage: 'unknown'
    }
  }
  
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`
    health.services.database = 'healthy'
  } catch (error) {
    health.services.database = 'unhealthy'
    health.status = 'error'
  }
  
  try {
    // Check Redis
    await redis.ping()
    health.services.redis = 'healthy'
  } catch (error) {
    health.services.redis = 'unhealthy'
    health.status = 'error'
  }
  
  try {
    // Check storage
    const fs = require('fs')
    fs.accessSync('./uploads', fs.constants.W_OK)
    health.services.storage = 'healthy'
  } catch (error) {
    health.services.storage = 'unhealthy'
    health.status = 'error'
  }
  
  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503
  })
}
```

## 9. Migration Strategy

### 9.1. Database Migration

```sql
-- migrations/001_add_return_tracking.sql
-- Step 1: Add new columns
ALTER TABLE barang_keluar 
ADD COLUMN IF NOT EXISTS isReturned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS returnedAt TIMESTAMP,
ADD COLUMN IF NOT EXISTS returnedById STRING,
ADD COLUMN IF NOT EXISTS returnMasukId STRING;

ALTER TABLE barang_masuk
ADD COLUMN IF NOT EXISTS isReturnTransaction BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS returnReferenceId STRING,
ADD COLUMN IF NOT EXISTS employeeId STRING;

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_barang_keluar_employee_returned 
ON barang_keluar(employeeId, isReturned);

CREATE INDEX IF NOT EXISTS idx_barang_masuk_return_transaction 
ON barang_masuk(isReturnTransaction, returnReferenceId);

-- Step 3: Create constraints
ALTER TABLE barang_keluar 
ADD CONSTRAINT IF NOT EXISTS fk_barang_keluar_returned_by 
FOREIGN KEY (returnedById) REFERENCES user(id);

ALTER TABLE barang_keluar 
ADD CONSTRAINT IF NOT EXISTS fk_barang_keluar_return_masuk 
FOREIGN KEY (returnMasukId) REFERENCES barang_masuk(id);

ALTER TABLE barang_masuk 
ADD CONSTRAINT IF NOT EXISTS fk_barang_masuk_return_reference 
FOREIGN KEY (returnReferenceId) REFERENCES barang_keluar(id);

ALTER TABLE barang_masuk 
ADD CONSTRAINT IF NOT EXISTS fk_barang_masuk_employee 
FOREIGN KEY (employeeId) REFERENCES user(id);

-- Step 4: Create view for employee summary
CREATE OR REPLACE VIEW employee_inventory_summary AS
SELECT 
  u.id as employeeId,
  u.name as employeeName,
  b.id as barangId,
  b.kode as barangKode,
  b.nama as barangNama,
  b.satuan as barangSatuan,
  g.id as gudangId,
  g.kode as gudangKode,
  g.nama as gudangNama,
  COALESCE(SUM(CASE WHEN bk.isReturned = FALSE THEN bk.jumlah ELSE 0 END), 0) as jumlahDipinjam,
  COALESCE(SUM(CASE WHEN bk.isReturned = TRUE THEN bk.jumlah ELSE 0 END), 0) as jumlahDikembalikan,
  MAX(bk.tanggal) as lastTransactionDate
FROM users u
LEFT JOIN barang_keluar bk ON u.id = bk.employeeId
LEFT JOIN barang b ON bk.barangId = b.id
LEFT JOIN gudang g ON bk.gudangId = g.id
WHERE u.role = 'EMPLOYEE'
GROUP BY u.id, u.name, b.id, b.kode, b.nama, b.satuan, g.id, g.kode, g.nama;
```

### 9.2. Feature Flag Implementation

```typescript
// lib/featureFlags.ts
export const FEATURE_FLAGS = {
  WAREHOUSE_RETURN: process.env.FEATURE_WAREHOUSE_RETURN === 'true',
  WAREHOUSE_HISTORY: process.env.FEATURE_WAREHOUSE_HISTORY === 'true',
  WAREHOUSE_STATS: process.env.FEATURE_WAREHOUSE_STATS === 'true'
}

// Usage in components
function KembaliTab() {
  if (!FEATURE_FLAGS.WAREHOUSE_RETURN) {
    return <div>Fitur pengembalian belum tersedia</div>
  }
  
  return (
    <div className="kembali-tab">
      {/* Return functionality */}
    </div>
  )
}
```

### 9.3. Rollback Plan

```typescript
// scripts/rollback.ts
import { prisma } from '@/lib/prisma'

async function rollbackWarehouseFeature() {
  try {
    // Disable feature flags
    process.env.FEATURE_WAREHOUSE_RETURN = 'false'
    
    // Redirect old routes
    // /employee/inventory -> /employee/warehouse (ambil tab)
    
    console.log('Warehouse feature rolled back successfully')
  } catch (error) {
    console.error('Rollback failed:', error)
    process.exit(1)
  }
}

// Database rollback script
const rollbackSQL = `
-- Drop new columns
ALTER TABLE barang_keluar DROP COLUMN IF EXISTS isReturned;
ALTER TABLE barang_keluar DROP COLUMN IF EXISTS returnedAt;
ALTER TABLE barang_keluar DROP COLUMN IF EXISTS returnedById;
ALTER TABLE barang_keluar DROP COLUMN IF EXISTS returnMasukId;

ALTER TABLE barang_masuk DROP COLUMN IF EXISTS isReturnTransaction;
ALTER TABLE barang_masuk DROP COLUMN IF EXISTS returnReferenceId;
ALTER TABLE barang_masuk DROP COLUMN IF EXISTS employeeId;

-- Drop indexes
DROP INDEX IF EXISTS idx_barang_keluar_employee_returned;
DROP INDEX IF EXISTS idx_barang_masuk_return_transaction;

-- Drop view
DROP VIEW IF EXISTS employee_inventory_summary;
`
```

## 10. Success Metrics & KPIs

### 10.1. User Experience Metrics

```typescript
// lib/analytics.ts
export const UX_METRICS = {
  // Time-based metrics
  averageReturnTime: 'average_time_to_complete_return',
  averageBorrowTime: 'average_time_to_complete_borrow',
  
  // Success metrics
  returnSuccessRate: 'return_transaction_success_rate',
  borrowSuccessRate: 'borrow_transaction_success_rate',
  
  // Error metrics
  returnErrorRate: 'return_transaction_error_rate',
  borrowErrorRate: 'borrow_transaction_error_rate',
  
  // Usage metrics
  dailyActiveUsers: 'daily_active_users',
  weeklyActiveUsers: 'weekly_active_users',
  monthlyActiveUsers: 'monthly_active_users'
}

// Tracking implementation
export function trackUserAction(action: string, properties: Record<string, any>) {
  // Send to analytics service
  analytics.track(action, {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ...properties
  })
}
```

### 10.2. Business Metrics

```typescript
// lib/businessMetrics.ts
export const BUSINESS_METRICS = {
  // Inventory accuracy
  inventoryAccuracy: 'inventory_accuracy_percentage',
  stockDiscrepancies: 'stock_discrepancy_count',
  
  // Operational efficiency
  averageBorrowDuration: 'average_borrow_duration_days',
  returnConditionBreakdown: 'return_condition_breakdown',
  
  // Cost savings
  reducedManualTracking: 'reduced_manual_tracking_hours',
  improvedInventoryTurnover: 'inventory_turnover_improvement'
}
```

### 10.3. Performance Metrics

```typescript
// lib/performanceMetrics.ts
export const PERFORMANCE_METRICS = {
  // Response times
  apiResponseTime: 'api_response_time_p95',
  pageLoadTime: 'page_load_time_p95',
  
  // System health
  uptime: 'system_uptime_percentage',
  errorRate: 'error_rate_percentage',
  
  // Resource usage
  cpuUsage: 'cpu_usage_percentage',
  memoryUsage: 'memory_usage_percentage',
  databaseConnections: 'database_connection_count'
}
```

---

## Conclusion

Implementasi menu "Gudang" yang baru ini akan memberikan pengalaman yang lebih baik untuk karyawan dalam mengelola barang yang dipinjam dan dikembalikan. Dengan pendekatan mobile-first, API yang robust, dan sistem tracking yang komprehensif, diharapkan dapat meningkatkan efisiensi operasional dan akurasi inventory.

Rekomendasi implementasi ini dirancang untuk:
1. **Scalability**: Dapat menangani pertumbuhan pengguna dan transaksi
2. **Maintainability**: Kode yang terstruktur dan mudah dipelihara
3. **Security**: Perlindungan data dan akses yang tepat
4. **Performance**: Responsif dan efisien dalam penggunaan sumber daya
5. **User Experience**: Intuitif dan mudah digunakan

Dengan mengikuti rekomendasi ini, implementasi dapat dilakukan secara bertahap dengan risiko yang minimal dan hasil yang maksimal.