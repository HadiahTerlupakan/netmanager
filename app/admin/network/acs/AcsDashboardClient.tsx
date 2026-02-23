"use client"

import { useState, useEffect } from 'react'
import { Activity, Wifi, AlertTriangle, RefreshCw, BarChart3, Settings, Power } from 'lucide-react'

interface DashboardData {
  metrics?: { value: number }[];
  connectionTypes?: { name: string; value: number }[];
  totalDevices?: number;
  rxPowerDistribution?: { labels: string[]; series: number[] };
  [key: string]: unknown;
}

export function AcsDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acs/dashboard')
      const result = await res.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 300000) // 5 minutes
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Memuat statistik ACS...</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-[#3b5fe5]" /> ACS Dashboard
          </h2>
          <p className="text-gray-500 text-sm mt-1">Ringkasan status seluruh ONT/Router di lapangan</p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className={"w-4 h-4 mr-2 " + (loading ? "animate-spin" : "")} /> Refresh
        </button>
      </div>

      {data && (
        <>
          {/* Main Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Settings className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Devices</p>
                <h3 className="text-2xl font-bold text-gray-900">{data.metrics?.[0]?.value || 0}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Online</p>
                <h3 className="text-2xl font-bold text-green-600">{data.metrics?.[1]?.value || 0}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
              <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                <Power className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Offline</p>
                <h3 className="text-2xl font-bold text-red-600">{data.metrics?.[2]?.value || 0}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
              <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Faults / Errors</p>
                <h3 className="text-2xl font-bold text-yellow-600">{data.metrics?.[3]?.value || 0}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Vendor Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Wifi className="w-5 h-5 mr-2 text-purple-500" /> Tipe Modem (Product Class)
              </h3>
              <div className="space-y-4 mt-6">
                {data.connectionTypes?.map((ct: { name: string; value: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs mr-3">
                        {ct.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-700">{ct.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-bold text-gray-900 mr-3">{ct.value}</span>
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${(ct.value / data.totalDevices) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!data.connectionTypes || data.connectionTypes.length === 0) && (
                  <div className="text-center py-6 text-gray-500">Belum ada data</div>
                )}
              </div>
            </div>

            {/* Sinyal Optik Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-500" /> Kualitas Sinyal (RX Power)
              </h3>
              <div className="space-y-4 mt-6">
                {data.rxPowerDistribution?.labels.map((label: string, i: number) => {
                  const val = data.rxPowerDistribution.series[i];
                  const color = label === 'Excellent' ? 'bg-green-500' :
                    label === 'Fair' ? 'bg-yellow-400' :
                      label === 'Poor' ? 'bg-red-500' : 'bg-gray-400';
                  const bgLight = label === 'Excellent' ? 'bg-green-100' :
                    label === 'Fair' ? 'bg-yellow-100' :
                      label === 'Poor' ? 'bg-red-100' : 'bg-gray-100';

                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${color} mr-3`}></div>
                        <span className="font-medium text-gray-700">{label}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-bold text-gray-900 mr-3">{val}</span>
                        <div className={`w-32 h-2 ${bgLight} rounded-full overflow-hidden`}>
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{ width: `${data.totalDevices ? (val / data.totalDevices) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
