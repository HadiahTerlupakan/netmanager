import { useState, useMemo } from 'react'
import { HiMagnifyingGlass, HiArrowTopRightOnSquare, HiShoppingCart, HiStar, HiCheckBadge } from 'react-icons/hi2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface MarketPriceCheckProps {
  initialKeyword?: string
  onSelectPrice?: (price: number) => void
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value)
}

// Helper to parse "100+ terjual", "1rb+ terjual", "5 terjual"
const parseSoldCount = (soldStr: string): number => {
    if (!soldStr) return 0
    let clean = soldStr.toLowerCase().replace(' terjual', '').replace('+', '').replace('rb', '000').replace(',', '.')
    if (clean.includes('jt')) {
       clean = clean.replace('jt', '000000')
    }
    // Remove non-numeric except dot if any (though usually rb/jt handles it)
    clean = clean.replace(/[^0-9.]/g, '')
    return parseFloat(clean) || 0
}

export function MarketPriceCheck({ initialKeyword = '', onSelectPrice }: MarketPriceCheckProps) {
  const [keyword, setKeyword] = useState(initialKeyword)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [selectedBrand, setSelectedBrand] = useState<string>('')

  const handleCheck = async () => {
    if (!keyword) return
    
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/integrations/market-price?keyword=${encodeURIComponent(keyword)}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to fetch data')

      setResult(data)
      setSelectedBrand('') // Reset filter on new search
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Advanced Analytics (Bar Chart Logic)
  const analytics = useMemo(() => {
    if (!result || !result.products.length) return null

    let totalWeightedPrice = 0
    let totalSoldWeight = 0
    
    // Parse numeric sold count
    const validProducts = result.products.map((p: any) => {
        const sold = parseSoldCount(p.sold)
        const weight = sold > 0 ? sold : 1
        totalWeightedPrice += p.price * weight
        totalSoldWeight += weight
        return { ...p, soldCount: sold }
    })

    const weightedAvg = totalSoldWeight > 0 ? Math.round(totalWeightedPrice / totalSoldWeight) : result.averagePrice

    // Create Price Buckets using Min/Max
    const min = result.minPrice
    const max = result.maxPrice
    const range = max - min
    const bucketCount = 5
    const step = Math.max(10000, Math.ceil(range / bucketCount)) // Min step 10k or dynamic

    // Initialize buckets
    const labels: string[] = []
    const data: number[] = []
    
    for (let i = 0; i < bucketCount; i++) {
        const start = min + (i * step)
        const end = start + step
        labels.push(`${(start/1000).toFixed(0)}k - ${(end/1000).toFixed(0)}k`)
        
        // Count total items sold in this price range
        const soldInBucket = validProducts
            .filter((p: any) => p.price >= start && p.price < end)
            .reduce((sum: number, p: any) => sum + p.soldCount, 0)
            
        data.push(soldInBucket)
    }
    
    const maxDataVal = Math.max(...data)

    // Location Analytics
    const locationCounts: Record<string, number> = {}
    validProducts.forEach((p: any) => {
        if (p.shopLocation) {
            locationCounts[p.shopLocation] = (locationCounts[p.shopLocation] || 0) + 1
        }
    })
    
    // Get Top 5 Locations
    const top5Locations = Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([loc, count]) => ({ city: loc, count }))

    // Brand Analytics (First word of name)
    const brandCounts: Record<string, number> = {}
    const ignoredWords = ['jual', 'promo', 'ready', 'cod', 'new', 'baru', 'bekas', 'second', 'termurah', 'original', 'asli', 'diskon', 'terbaru']
    
    validProducts.forEach((p: any) => {
        const firstWord = p.name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        if (firstWord.length > 2 && !ignoredWords.includes(firstWord)) {
             // Capitalize first letter for display
             const displayBrand = firstWord.charAt(0).toUpperCase() + firstWord.slice(1)
             brandCounts[displayBrand] = (brandCounts[displayBrand] || 0) + 1
        }
    })
    
    const topBrands = Object.entries(brandCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

    // Identify Best Seller (Highest Sold Count)
    const bestSellerItem = validProducts.length > 0 
        ? validProducts.reduce((prev: any, current: any) => (prev.soldCount > current.soldCount) ? prev : current, validProducts[0])
        : null

    // Shop Recommendations (Relaxed: Rating > 4.5 + Sold > 0)
    // Use validProducts to ensure soldCount is available
    const recommendedShops = validProducts
        .filter((p: any) => {
            // Brand Filter
            if (selectedBrand) {
                const pBrand = p.name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                if (pBrand !== selectedBrand.toLowerCase()) return false
            }
            
            const r = p.rating && !isNaN(parseFloat(p.rating)) ? parseFloat(p.rating) : 0
            // Allow slightly lower rating to ensure items appear
            return r >= 4.0 && p.soldCount > 0
        })
        .sort((a: any, b: any) => {
             // Sort by Rating then Sold
            const ratingDiff = parseFloat(b.rating) - parseFloat(a.rating)
            if (ratingDiff !== 0) return ratingDiff
            return b.soldCount - a.soldCount
        })
        .slice(0, 3) // Top 3

    return {
        weightedAvg,
        top5Locations,
        topBrands,
        bestSellerItem,
        recommendedShops,
        chartData: {
            labels,
            datasets: [
                {
                    label: 'Volume Penjualan',
                    data: data,
                    backgroundColor: data.map(val => val === maxDataVal ? 'rgba(54, 162, 235, 0.8)' : 'rgba(201, 203, 207, 0.5)'), // Highlight max
                    borderRadius: 4,
                }
            ]
        },
        chartOptions: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Unit Terjual' }
                },
                x: {
                   title: { display: true, text: 'Rentang Harga' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                         label: (context: any) => `Terjual: ${context.parsed.y} unit`
                    }
                }
            }
        }
    }
  }, [result, selectedBrand])


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 w-full">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <HiShoppingCart className="w-5 h-5 text-green-500" />
        Analisa Harga Pasar (Tokopedia)
      </h3>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-1 input input-bordered input-sm dark:bg-gray-900"
          placeholder="Nama barang (cth: Laptop Asus ROG)..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
        />
        <button 
          className="btn btn-sm btn-primary"
          onClick={handleCheck}
          disabled={loading || !keyword}
        >
          {loading ? <span className="loading loading-spinner loading-xs"></span> : <HiMagnifyingGlass className="w-4 h-4" />}
          Cek
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded mb-3">
          Error: {error}
        </div>
      )}

      {result && analytics && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">Harga Terendah</p>
              <p className="font-semibold text-green-600 text-sm">{formatCurrency(result.minPrice)}</p>
            </div>
            {/* Using Weighted Average as the "True" Market Price benchmark */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Harga Wajar*</p>
              <p className="font-bold text-blue-700 dark:text-blue-200 text-sm" title="Rata-rata tertimbang berdasarkan jumlah terjual">{formatCurrency(analytics.weightedAvg)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Rata-Rata Biasa</p>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{formatCurrency(result.averagePrice)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Harga Tertinggi</p>
              <p className="font-semibold text-red-600 text-sm">{formatCurrency(result.maxPrice)}</p>
            </div>
          </div>
          
           {/* Chart Section */}
           <div className="h-64 w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg p-2 relative">
               <h4 className="text-xs font-medium text-gray-500 mb-2 text-center">Volume Penjualan per Rentang Harga</h4>
               <Bar options={analytics.chartOptions} data={analytics.chartData} />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shop Recommendations */}
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                            <HiCheckBadge className="w-4 h-4" />
                            Rekomendasi Toko
                        </h4>
                        
                        {/* Brand Filter Chips */}
                        {analytics.topBrands.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                                {analytics.topBrands.map((b: any) => (
                                    <button 
                                        key={b.name}
                                        onClick={() => setSelectedBrand(selectedBrand === b.name ? '' : b.name)}
                                        className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                                            selectedBrand === b.name 
                                            ? 'bg-yellow-600 text-white border-yellow-600' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-400'
                                        }`}
                                    >
                                        {b.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Best Seller Highlight */}
                    {analytics.bestSellerItem && analytics.bestSellerItem.soldCount > 0 && (
                        <div className="mb-3 p-2 bg-linear-to-r from-yellow-100 to-white dark:from-yellow-900/40 dark:to-gray-800 rounded border border-yellow-200 dark:border-yellow-700 flex items-center gap-3">
                            <div className="relative">
                                <img src={analytics.bestSellerItem.image} alt="Best Seller" className="w-12 h-12 rounded object-cover border border-white shadow-sm" />
                                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full animate-pulse">
                                    TOP 1
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-wider mb-0.5">Paling Laris</p>
                                <a href={analytics.bestSellerItem.url} target="_blank" rel="noopener" className="text-xs font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 line-clamp-1">
                                    {analytics.bestSellerItem.name}
                                </a>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold text-orange-600">{analytics.bestSellerItem.priceText}</span>
                                    <span className="text-[10px] text-gray-500">• {analytics.bestSellerItem.sold} Terjual</span>
                                    <span className="text-[10px] text-gray-500">• {analytics.bestSellerItem.shopName}</span>
                                </div>
                            </div>
                            <a href={analytics.bestSellerItem.url} target="_blank" rel="noopener" className="btn btn-xs btn-primary">Lihat</a>
                        </div>
                    )}
                    
                    {analytics.recommendedShops.length > 0 ? (
                        <div className="space-y-2">
                            {analytics.recommendedShops.map((shop: any) => (
                                <a 
                                        key={shop.id} 
                                        href={shop.url} 
                                        target="_blank" 
                                        rel="noopener"
                                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-yellow-100 dark:border-yellow-900/30 hover:shadow-sm transition-shadow"
                                    >
                                    <img src={shop.image} alt={shop.shopName} className="w-8 h-8 rounded object-cover bg-gray-100" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-gray-900 dark:text-gray-200 truncate">{shop.shopName}</p>
                                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" /> {shop.rating} | {shop.sold}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-green-600">{shop.priceText}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500 italic text-center py-2">
                             {selectedBrand 
                              ? `Tidak ada rekomendasi toko untuk brand "${selectedBrand}" dengan rating tinggi.` 
                              : `Tidak ada rekomendasi toko dengan rating tinggi (&ge;4.0) untuk kata kunci ini.`}
                        </p>
                    )}
                </div>

                {/* Top 5 Locations */}
                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-1">
                        📍 Sebaran Lokasi Penjual (Top 5)
                    </h4>
                    <div className="space-y-1">
                    {analytics.top5Locations.map((loc: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-900/20">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                {idx + 1}. {loc.city}
                            </span>
                            <span className="font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/40 px-1.5 rounded">{loc.count} Produk</span>
                        </div>
                    ))}
                    </div>
                </div>
           </div>

          {/* Product Table */}
          <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
             <table className="table table-sm w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 font-medium text-gray-500 text-xs">
                    <tr>
                        <th className="w-12">#</th>
                        <th>Produk</th>
                        <th>Harga</th>
                        <th>Rating</th>
                        <th>Terjual</th>
                        <th>Toko</th>
                        <th className="text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="text-xs">
                    {result.products.map((item: any, idx: number) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                            <td className="text-center text-gray-400">{idx + 1}</td>
                            <td>
                                <div className="flex items-start gap-3">
                                    <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded shadow-sm shrink-0" />
                                    <a href={item.url} target="_blank" rel="noopener" className="font-medium text-gray-900 dark:text-blue-200 hover:text-blue-600 line-clamp-2 max-w-[200px]">
                                        {item.name}
                                    </a>
                                </div>
                            </td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-bold text-orange-600">{item.priceText}</span>
                                    {item.discount > 0 && (
                                        <div className="flex items-center gap-1 text-[10px]">
                                            <span className="bg-red-100 text-red-600 px-1 rounded">{item.discount}%</span>
                                            <span className="text-gray-400 line-through">{formatCurrency(item.originalPrice)}</span>
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td>
                                <div className="flex items-center gap-1">
                                    <HiStar className="w-3 h-3 text-yellow-400" />
                                    <span className="font-medium">{item.rating ?? '-'}</span>
                                    <span className="text-gray-400">({item.reviewCount ?? 0})</span>
                                </div>
                            </td>
                            <td>
                                {item.sold ? (
                                    <span className="text-gray-600 font-medium">{item.sold}</span>
                                ) : (
                                    <span className="text-gray-300">-</span>
                                )}
                            </td>
                            <td>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                        {(item.badge?.includes('Official') || item.badge?.includes('Power')) && (
                                            <HiCheckBadge className="w-3 h-3 text-blue-500" />
                                        )}
                                        <span className="font-medium truncate max-w-[120px]" title={item.shopName}>{item.shopName}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500">{item.shopLocation}</span>
                                </div>
                            </td>
                            <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                     <a 
                                        href={item.url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="btn btn-xs btn-ghost btn-square"
                                        title="Buka Tokopedia"
                                    >
                                        <HiArrowTopRightOnSquare className="w-4 h-4 text-gray-400 hover:text-green-600" />
                                    </a>

                                    {onSelectPrice && (
                                        <button 
                                            onClick={() => onSelectPrice(item.price)}
                                            className="btn btn-xs btn-primary btn-outline"
                                        >
                                            Pilih
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
          
          <div className="text-[10px] flex justify-between items-center text-gray-400 mt-2">
             <span>*Harga Wajar: Rata-rata tertimbang berdasarkan popularitas (jumlah terjual).</span>
             <span>Sumber: Tokopedia Search Engine V4</span>
          </div>
        </div>
      )}
    </div>
  )
}
