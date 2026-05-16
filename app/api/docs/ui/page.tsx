"use client";
export const dynamic = "force-dynamic";

import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";
import nextDynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { Button } from "@/components/ui/Button";

// Dynamic import to prevent SSR issues
const SwaggerUI = nextDynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading Swagger UI...</p>
      </div>
    </div>
  ),
});

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/docs")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch API spec");
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        clientLogger.error("Error loading API spec:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center max-w-md p-6 bg-gray-800 rounded-lg">
          <div className="text-red-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Error Loading Documentation
          </h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="swagger-wrapper">
      <style jsx global>{`
        /* Dark Theme for Swagger UI */
        .swagger-wrapper {
          min-height: 100vh;
          background: #1a1a2e;
        }

        .swagger-ui {
          font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
        }

        /* Header/Info Section */
        .swagger-ui .info {
          margin: 30px 0;
        }

        .swagger-ui .info .title {
          color: #fff;
          font-size: 2.5rem;
          font-weight: 700;
        }

        .swagger-ui .info .description {
          color: #a0aec0;
          font-size: 1rem;
        }

        .swagger-ui .info .description h1,
        .swagger-ui .info .description h2,
        .swagger-ui .info .description h3 {
          color: #fff;
          margin-top: 1.5em;
        }

        .swagger-ui .info .description ul {
          color: #a0aec0;
        }

        .swagger-ui .info .description strong {
          color: #60a5fa;
        }

        /* Scheme Container */
        .swagger-ui .scheme-container {
          background: #16213e;
          box-shadow: none;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .swagger-ui .scheme-container .schemes > label {
          color: #a0aec0;
        }

        /* Tags/Groups */
        .swagger-ui .opblock-tag {
          color: #fff;
          border-bottom: 1px solid #2d3748;
          font-size: 1.25rem;
        }

        .swagger-ui .opblock-tag:hover {
          background: #16213e;
        }

        .swagger-ui .opblock-tag small {
          color: #718096;
        }

        /* Operation Blocks */
        .swagger-ui .opblock {
          background: #16213e;
          border: 1px solid #2d3748;
          border-radius: 8px;
          margin: 10px 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .swagger-ui .opblock .opblock-summary {
          border: none;
        }

        .swagger-ui .opblock .opblock-summary-method {
          border-radius: 4px;
          font-weight: 600;
          min-width: 80px;
        }

        .swagger-ui .opblock .opblock-summary-path {
          color: #e2e8f0;
          font-family: "JetBrains Mono", monospace;
        }

        .swagger-ui .opblock .opblock-summary-description {
          color: #a0aec0;
        }

        /* GET - Green */
        .swagger-ui .opblock.opblock-get {
          background: linear-gradient(135deg, #0d3d30 0%, #16213e 100%);
          border-color: #10b981;
        }

        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #10b981;
        }

        .swagger-ui .opblock.opblock-get .opblock-summary {
          border-color: transparent;
        }

        /* POST - Blue */
        .swagger-ui .opblock.opblock-post {
          background: linear-gradient(135deg, #1e3a5f 0%, #16213e 100%);
          border-color: #3b82f6;
        }

        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #3b82f6;
        }

        .swagger-ui .opblock.opblock-post .opblock-summary {
          border-color: transparent;
        }

        /* PUT - Orange */
        .swagger-ui .opblock.opblock-put {
          background: linear-gradient(135deg, #4a3c1e 0%, #16213e 100%);
          border-color: #f59e0b;
        }

        .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: #f59e0b;
        }

        .swagger-ui .opblock.opblock-put .opblock-summary {
          border-color: transparent;
        }

        /* DELETE - Red */
        .swagger-ui .opblock.opblock-delete {
          background: linear-gradient(135deg, #4a1e1e 0%, #16213e 100%);
          border-color: #ef4444;
        }

        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: #ef4444;
        }

        .swagger-ui .opblock.opblock-delete .opblock-summary {
          border-color: transparent;
        }

        /* PATCH - Purple */
        .swagger-ui .opblock.opblock-patch {
          background: linear-gradient(135deg, #3d1e5f 0%, #16213e 100%);
          border-color: #8b5cf6;
        }

        .swagger-ui .opblock.opblock-patch .opblock-summary-method {
          background: #8b5cf6;
        }

        .swagger-ui .opblock.opblock-patch .opblock-summary {
          border-color: transparent;
        }

        /* Operation Body */
        .swagger-ui .opblock-body {
          background: #1a1a2e;
        }

        .swagger-ui .opblock-body pre {
          background: #0f0f1a;
          color: #e2e8f0;
          border-radius: 6px;
        }

        .swagger-ui .opblock-section-header {
          background: #16213e;
          border-radius: 4px;
        }

        .swagger-ui .opblock-section-header h4 {
          color: #fff;
        }

        .swagger-ui .opblock-section-header label {
          color: #a0aec0;
        }

        /* Parameters */
        .swagger-ui .parameters-col_description {
          color: #a0aec0;
        }

        .swagger-ui .parameter__name {
          color: #60a5fa;
        }

        .swagger-ui .parameter__type {
          color: #10b981;
        }

        .swagger-ui .parameter__in {
          color: #718096;
        }

        .swagger-ui table thead tr th {
          color: #fff;
          border-bottom: 1px solid #2d3748;
        }

        .swagger-ui table tbody tr td {
          border-bottom: 1px solid #2d3748;
          color: #e2e8f0;
        }

        /* Models/Schemas */
        .swagger-ui section.models {
          border: 1px solid #2d3748;
          border-radius: 8px;
          background: #16213e;
        }

        .swagger-ui section.models h4 {
          color: #fff;
          border: none;
        }

        .swagger-ui section.models .model-container {
          background: #1a1a2e;
          border-radius: 6px;
          margin: 10px 0;
        }

        .swagger-ui .model {
          color: #e2e8f0;
        }

        .swagger-ui .model-title {
          color: #60a5fa;
        }

        .swagger-ui .prop-type {
          color: #10b981;
        }

        .swagger-ui .prop-format {
          color: #f59e0b;
        }

        /* Buttons */
        .swagger-ui .btn {
          border-radius: 6px;
          font-weight: 500;
        }

        .swagger-ui .btn.execute {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .swagger-ui .btn.execute:hover {
          background: #2563eb;
        }

        .swagger-ui .btn.cancel {
          background: #4b5563;
          border-color: #4b5563;
        }

        .swagger-ui .btn.authorize {
          background: #10b981;
          border-color: #10b981;
          color: #fff;
        }

        .swagger-ui .btn.authorize svg {
          fill: #fff;
        }

        /* Inputs */
        .swagger-ui input[type="text"],
        .swagger-ui textarea {
          background: #0f0f1a;
          border: 1px solid #2d3748;
          color: #e2e8f0;
          border-radius: 6px;
        }

        .swagger-ui input[type="text"]:focus,
        .swagger-ui textarea:focus {
          border-color: #3b82f6;
          outline: none;
        }

        .swagger-ui select {
          background: #0f0f1a;
          border: 1px solid #2d3748;
          color: #e2e8f0;
          border-radius: 6px;
        }

        /* Responses */
        .swagger-ui .responses-inner h4,
        .swagger-ui .responses-inner h5 {
          color: #fff;
        }

        .swagger-ui .response-col_status {
          color: #10b981;
        }

        .swagger-ui .response-col_description {
          color: #a0aec0;
        }

        /* Authorization Modal */
        .swagger-ui .dialog-ux .modal-ux {
          background: #16213e;
          border: 1px solid #2d3748;
          border-radius: 12px;
        }

        .swagger-ui .dialog-ux .modal-ux-header h3 {
          color: #fff;
        }

        .swagger-ui .dialog-ux .modal-ux-content {
          color: #a0aec0;
        }

        .swagger-ui .dialog-ux .modal-ux-content p {
          color: #a0aec0;
        }

        .swagger-ui .dialog-ux .modal-ux-content label {
          color: #e2e8f0;
        }

        /* Markdown Links */
        .swagger-ui a {
          color: #60a5fa;
        }

        .swagger-ui a:hover {
          color: #93c5fd;
        }

        /* Scrollbar */
        .swagger-ui ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .swagger-ui ::-webkit-scrollbar-track {
          background: #1a1a2e;
        }

        .swagger-ui ::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }

        .swagger-ui ::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }

        /* Top Bar */
        .swagger-ui .topbar {
          display: none;
        }

        /* Custom Header */
        .custom-header {
          background: linear-gradient(135deg, #1e3a5f 0%, #16213e 100%);
          padding: 20px 40px;
          border-bottom: 1px solid #2d3748;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .custom-header h1 {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .custom-header .badge {
          background: #10b981;
          color: #fff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .custom-header .links {
          display: flex;
          gap: 16px;
        }

        .custom-header .links a {
          color: #a0aec0;
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }

        .custom-header .links a:hover {
          color: #60a5fa;
        }

        /* Filter/Search */
        .swagger-ui .filter-container {
          background: #16213e;
          border-radius: 8px;
          margin: 20px 0;
        }

        .swagger-ui .filter-container input {
          background: #0f0f1a;
          border: 1px solid #2d3748;
          color: #e2e8f0;
        }
      `}</style>

      {/* Custom Header */}
      <div className="custom-header">
        <h1>
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          NetManager API
          <span className="badge">v1.0.0</span>
        </h1>
        <div className="links">
          <a href="/api/docs" target="_blank" rel="noopener noreferrer">
            📄 OpenAPI JSON
          </a>
          <a href="/admin" rel="noopener noreferrer">
            🏠 Back to Admin
          </a>
        </div>
      </div>

      {/* Swagger UI */}
      {spec && (
        <SwaggerUI
          spec={spec}
          docExpansion="list"
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          tryItOutEnabled={true}
        />
      )}
    </div>
  );
}
