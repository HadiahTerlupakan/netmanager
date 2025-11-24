"use client"

import { useEffect, useState } from 'react'

export default function TestPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    // Load all localStorage data
    const token = localStorage.getItem('pelanggan_token')
    const pelangganData = localStorage.getItem('pelanggan_data')

    setData({
      token: token,
      pelangganData: pelangganData ? JSON.parse(pelangganData) : null,
      hasToken: !!token,
      hasData: !!pelangganData
    })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page - Portal Pelanggan</h1>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold mb-2">LocalStorage Status:</h2>
        <p>Has Token: {data?.hasToken ? '✅ Yes' : '❌ No'}</p>
        <p>Has Pelanggan Data: {data?.hasData ? '✅ Yes' : '❌ No'}</p>
      </div>

      {data?.token && (
        <div className="bg-blue-100 p-4 rounded mb-4">
          <h2 className="font-bold mb-2">Token:</h2>
          <p className="font-mono text-sm break-all">{data.token}</p>
        </div>
      )}

      {data?.pelangganData && (
        <div className="bg-green-100 p-4 rounded mb-4">
          <h2 className="font-bold mb-2">Pelanggan Data:</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(data.pelangganData, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-4">
        <a href="/pelanggan" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Go to Dashboard
        </a>
        {' '}
        <a href="/pelanggan/login" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Go to Login
        </a>
      </div>
    </div>
  )
}