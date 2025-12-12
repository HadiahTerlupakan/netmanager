'use client'

import { useEffect, useState } from 'react'

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/docs')
      .then((res) => res.json())
      .then((data) => {
        setSpec(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading API spec:', error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading API Documentation...</p>
        </div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Error loading API documentation</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {spec.info?.title || 'API Documentation'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {spec.info?.description || 'API endpoints documentation'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Version: {spec.info?.version || '1.0.0'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(spec.paths || {}).map(([path, methods]: [string, any]) => (
            <div key={path} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {path}
              </h3>
              <div className="space-y-2">
                {Object.entries(methods).map(([method, details]: [string, any]) => (
                  <div key={method} className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      method === 'get' ? 'bg-green-100 text-green-800' :
                      method === 'post' ? 'bg-blue-100 text-blue-800' :
                      method === 'put' ? 'bg-yellow-100 text-yellow-800' :
                      method === 'delete' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {method.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {details.summary || 'No description'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <a
            href="/api/docs"
            target="_blank"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Raw OpenAPI Spec
          </a>
        </div>
      </div>
    </div>
  )
}

