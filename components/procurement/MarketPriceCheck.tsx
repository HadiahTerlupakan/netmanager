import Image from "next/image";
import { useState, useMemo } from "react";
import {
  HiMagnifyingGlass,
  HiArrowTopRightOnSquare,
  HiStar,
  HiCheckBadge,
  HiOutlineCurrencyDollar,
  HiOutlineChartBar,
  HiOutlineBuildingStorefront,
  HiOutlineTag,
} from "react-icons/hi2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Button } from "@/components/ui/Button";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface MarketPriceCheckProps {
  initialKeyword?: string;
  onSelectPrice?: (price: number) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

// Helper to parse "100+ terjual", "1rb+ terjual", "5 terjual"
const parseSoldCount = (soldStr: string): number => {
  if (!soldStr) return 0;
  let clean = soldStr
    .toLowerCase()
    .replace(" terjual", "")
    .replace("+", "")
    .replace("rb", "000")
    .replace(",", ".");
  if (clean.includes("jt")) {
    clean = clean.replace("jt", "000000");
  }
  // Remove non-numeric except dot if any (though usually rb/jt handles it)
  clean = clean.replace(/[^0-9.]/g, "");
  return parseFloat(clean) || 0;
};

interface Product {
  id: string;
  name: string;
  price: number;
  priceText: string;
  sold: string;
  rating: string;
  reviewCount: string;
  shopName: string;
  shopLocation: string;
  image: string;
  url: string;
  discount: number;
  originalPrice: number;
  badge?: string;
  soldCount: number;
}

interface MarketPriceResult {
  products: Product[];
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

export function MarketPriceCheck({
  initialKeyword = "",
  onSelectPrice,
}: MarketPriceCheckProps) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MarketPriceResult | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  const handleCheck = async () => {
    if (!keyword) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/integrations/market-price?keyword=${encodeURIComponent(keyword)}`,
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal mengambil data");

      setResult(data);
      setSelectedBrand(""); // Reset filter on new search
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  // Advanced Analytics (Bar Chart Logic)
  const analytics = useMemo(() => {
    if (!result || !result.products.length) return null;

    // Parse numeric sold count + accumulate weighted totals
    const { validProducts, totalWeightedPrice, totalSoldWeight } =
      result.products.reduce(
        (acc, p: Product) => {
          const sold = parseSoldCount(p.sold);
          const weight = sold > 0 ? sold : 1;
          acc.validProducts.push({ ...p, soldCount: sold });
          acc.totalWeightedPrice += p.price * weight;
          acc.totalSoldWeight += weight;
          return acc;
        },
        {
          validProducts: [] as Array<Product & { soldCount: number }>,
          totalWeightedPrice: 0,
          totalSoldWeight: 0,
        },
      );

    const weightedAvg =
      totalSoldWeight > 0
        ? Math.round(totalWeightedPrice / totalSoldWeight)
        : result.averagePrice;

    // Create Price Buckets using Min/Max
    const min = result.minPrice;
    const max = result.maxPrice;
    const range = max - min;
    const bucketCount = 5;
    const step = Math.max(10000, Math.ceil(range / bucketCount)); // Min step 10k or dynamic

    // Initialize buckets
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const start = min + i * step;
      const end = start + step;
      labels.push(
        `${(start / 1000).toFixed(0)}k - ${(end / 1000).toFixed(0)}k`,
      );

      // Count total items sold in this price range
      const soldInBucket = validProducts
        .filter((p: Product) => p.price >= start && p.price < end)
        .reduce((sum: number, p: Product) => sum + p.soldCount, 0);

      data.push(soldInBucket);
    }

    const maxDataVal = Math.max(...data);

    // Location Analytics
    const locationCounts: Record<string, number> = {};
    validProducts.forEach((p: Product) => {
      if (p.shopLocation) {
        locationCounts[p.shopLocation] =
          (locationCounts[p.shopLocation] || 0) + 1;
      }
    });

    // Get Top 5 Locations
    const top5Locations = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([loc, count]) => ({ city: loc, count }));

    // Brand Analytics (First word of name)
    const brandCounts: Record<string, number> = {};
    const ignoredWords = [
      "jual",
      "promo",
      "ready",
      "cod",
      "new",
      "baru",
      "bekas",
      "second",
      "termurah",
      "original",
      "asli",
      "diskon",
      "terbaru",
    ];

    validProducts.forEach((p: Product) => {
      const firstWord = p.name
        .split(" ")[0]
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      if (firstWord.length > 2 && !ignoredWords.includes(firstWord)) {
        // Capitalize first letter for display
        const displayBrand =
          firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        brandCounts[displayBrand] = (brandCounts[displayBrand] || 0) + 1;
      }
    });

    const topBrands = Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Identify Best Seller (Highest Sold Count)
    const bestSellerItem =
      validProducts.length > 0
        ? validProducts.reduce(
            (prev: Product, current: Product) =>
              prev.soldCount > current.soldCount ? prev : current,
            validProducts[0],
          )
        : null;

    // Shop Recommendations (Relaxed: Rating > 4.5 + Sold > 0)
    // Use validProducts to ensure soldCount is available
    const recommendedShops = validProducts
      .filter((p: Product) => {
        // Brand Filter
        if (selectedBrand) {
          const pBrand = p.name
            .split(" ")[0]
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();
          if (pBrand !== selectedBrand.toLowerCase()) return false;
        }

        const r =
          p.rating && !isNaN(parseFloat(p.rating)) ? parseFloat(p.rating) : 0;
        // Allow slightly lower rating to ensure items appear
        return r >= 4.0 && p.soldCount > 0;
      })
      .sort((a: Product, b: Product) => {
        // Sort by Rating then Sold
        const ratingDiff = parseFloat(b.rating) - parseFloat(a.rating);
        if (ratingDiff !== 0) return ratingDiff;
        return b.soldCount - a.soldCount;
      })
      .slice(0, 3); // Top 3

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
            label: "Volume Penjualan",
            data: data,
            backgroundColor: data.map((val) =>
              val === maxDataVal
                ? "rgba(79, 70, 229, 0.8)"
                : "rgba(209, 213, 219, 0.5)",
            ), // Indigo for max
            borderRadius: 6,
          },
        ],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: false, text: "Unit Terjual" },
            grid: { display: false },
          },
          x: {
            title: { display: true, text: "Rentang Harga" },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: { parsed: { y: number } }) =>
                `Terjual: ${context.parsed.y} unit`,
            },
          },
        },
      },
    };
  }, [result, selectedBrand]);

  return (
    <div className="w-full space-y-6">
      {/* Enhanced Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Cek Harga Pasar
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xl mx-auto">
          Cari referensi harga barang secara real-time dari marketplace untuk
          estimasi budget yang lebih akurat.
        </p>

        <div className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <HiMagnifyingGlass className="h-6 w-6 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-lg"
            placeholder="Masukkan nama barang spesifik (cth: Ubiquiti LiteBeam M5)..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          />
          <Button
            className="absolute right-2 top-2 bottom-2"
            onClick={handleCheck}
            disabled={loading || !keyword}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              "Cari"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      {result && analytics && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Min Price */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <HiOutlineTag className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Harga Terendah
                </p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(result.minPrice)}
              </p>
            </div>

            {/* Fair Price (Weighted Avg) - Highlighted */}
            <div className="bg-linear-to-br from-indigo-500 to-purple-600 p-5 rounded-xl shadow-lg text-white transform hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg text-white">
                  <HiCheckBadge className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-indigo-100">
                  Harga Wajar*
                </p>
              </div>
              <p className="text-2xl font-bold text-white mb-1">
                {formatCurrency(analytics.weightedAvg)}
              </p>
              <p className="text-xs text-indigo-100/80">
                *Rata-rata tertimbang vol. penjualan
              </p>
            </div>

            {/* Average Price */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <HiOutlineCurrencyDollar className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Rata-Rata Biasa
                </p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(result.averagePrice)}
              </p>
            </div>

            {/* Max Price */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                  <HiOutlineChartBar className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Harga Tertinggi
                </p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(result.maxPrice)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <HiOutlineChartBar className="w-5 h-5 text-indigo-500" />
                Distribusi Penjualan per Harga
              </h3>
              <div className="h-64 w-full">
                <Bar
                  options={analytics.chartOptions}
                  data={analytics.chartData}
                />
              </div>
            </div>

            {/* Top Locations & Brands */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 space-y-6">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Top Lokasi Penjual
                </h4>
                <div className="space-y-2">
                  {analytics.top5Locations.map(
                    (loc: { city: string; count: number }, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-sm p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/50"
                      >
                        <span className="text-gray-600 dark:text-gray-300">
                          {loc.city}
                        </span>
                        <span className="font-bold text-purple-600 dark:text-purple-400 text-xs bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                          {loc.count}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {analytics.topBrands.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Top Kata Kunci (Brand)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analytics.topBrands.map(
                      (b: { name: string; count: number }) => (
                        <Button
                          key={b.name}
                          variant={
                            selectedBrand === b.name ? "default" : "secondary"
                          }
                          size="sm"
                          onClick={() =>
                            setSelectedBrand(
                              selectedBrand === b.name ? "" : b.name,
                            )
                          }
                          className="rounded-full"
                        >
                          {b.name}{" "}
                          <span className="opacity-60 text-[10px] ml-1">
                            ({b.count})
                          </span>
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations & Best Seller */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analytics.bestSellerItem &&
              analytics.bestSellerItem.soldCount > 0 && (
                <div className="bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 p-5 rounded-xl border border-amber-100 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-sm">
                      #1 PALING LARIS
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <Image
                      width={64}
                      height={64}
                      src={analytics.bestSellerItem.image}
                      alt="Best Seller"
                      className="rounded-lg object-cover border border-white shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <a
                        href={analytics.bestSellerItem.url}
                        target="_blank"
                        rel="noopener"
                        className="font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-orange-600 transition-colors"
                      >
                        {analytics.bestSellerItem.name}
                      </a>
                      <p className="text-sm font-semibold text-orange-600 mt-1">
                        {analytics.bestSellerItem.priceText}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {analytics.bestSellerItem.sold} Terjual •{" "}
                        {analytics.bestSellerItem.shopName}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Shop Recommendations */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <HiOutlineBuildingStorefront className="w-5 h-5 text-gray-400" />
                Rekomendasi Toko (Rating &gt; 4.0)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analytics.recommendedShops.length > 0 ? (
                  analytics.recommendedShops.map((shop: Product) => (
                    <a
                      key={shop.id}
                      href={shop.url}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
                    >
                      <Image
                        width={40}
                        height={40}
                        src={shop.image}
                        alt={shop.shopName}
                        className="rounded-lg object-cover bg-gray-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-200 group-hover:text-indigo-600 transition-colors truncate">
                          {shop.shopName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center text-amber-500">
                            <HiStar className="w-3 h-3 mr-0.5" /> {shop.rating}
                          </span>
                          <span>•</span>
                          <span>{shop.sold} items</span>
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Tidak ada rekomendasi toko yang memenuhi kriteria.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Product Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">
                Detail Semua Produk ({result.products.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 w-16">#</th>
                    <th className="px-6 py-4">Produk</th>
                    <th className="px-6 py-4">Harga</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Terjual</th>
                    <th className="px-6 py-4">Toko</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                  {result.products.map((item: Product, idx: number) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                    >
                      <td className="px-6 py-4 text-center text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-4">
                          <div className="relative shrink-0">
                            <Image
                              width={48}
                              height={48}
                              src={item.image}
                              alt={item.name}
                              className="object-cover rounded-lg shadow-sm"
                            />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener"
                              className="font-medium text-gray-900 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2"
                            >
                              {item.name}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {item.priceText}
                          </span>
                          {item.discount > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 rounded font-medium">
                                {item.discount}%
                              </span>
                              <span className="text-xs text-gray-400 line-through decoration-gray-400/60">
                                {formatCurrency(item.originalPrice)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.rating ? (
                          <div className="flex items-center gap-1.5">
                            <HiStar className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {item.rating}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({item.reviewCount})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.sold ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {item.sold}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-200">
                            <span
                              className="truncate max-w-[140px]"
                              title={item.shopName}
                            >
                              {item.shopName}
                            </span>
                            {(item.badge?.includes("Official") ||
                              item.badge?.includes("Power")) && (
                              <HiCheckBadge
                                className="w-4 h-4 text-blue-500 shrink-0"
                                title="Official/Power Merchant"
                              />
                            )}
                          </div>
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                            {item.shopLocation}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            title="Buka di Tokopedia"
                          >
                            <HiArrowTopRightOnSquare className="w-5 h-5" />
                          </a>

                          {onSelectPrice && (
                            <Button
                              size="sm"
                              onClick={() => onSelectPrice(item.price)}
                            >
                              Pilih
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-400 px-2">
            <span>
              *Harga Wajar dihitung menggunakan rata-rata tertimbang (harga x
              estimasi unit terjual) untuk mengurangi bias harga outlier.
            </span>
            <span>Powered by Internal Tokopedia Scraper Engine</span>
          </div>
        </div>
      )}
    </div>
  );
}
