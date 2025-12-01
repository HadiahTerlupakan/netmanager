/**
 * Design theme configuration for customer portal (Portal Pelanggan)
 * Provides consistent colors, spacing, and design tokens
 */

export const pelangganTheme = {
    colors: {
        // Primary colors - Sky/Cyan for friendly customer-facing design
        primary: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9', // Main sky blue
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
        },
        // Secondary colors - Cyan
        secondary: {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
        },
        // Status colors
        success: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#22c55e',
            600: '#16a34a',
        },
        warning: {
            50: '#fefce8',
            100: '#fef9c3',
            500: '#eab308',
            600: '#ca8a04',
        },
        error: {
            50: '#fef2f2',
            100: '#fee2e2',
            500: '#ef4444',
            600: '#dc2626',
        },
        // Neutral colors
        gray: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827',
        },
    },

    spacing: {
        xs: '0.25rem',    // 4px
        sm: '0.5rem',     // 8px
        md: '1rem',       // 16px
        lg: '1.5rem',     // 24px
        xl: '2rem',       // 32px
        '2xl': '3rem',    // 48px
        '3xl': '4rem',    // 64px
    },

    borderRadius: {
        sm: '0.375rem',   // 6px
        md: '0.5rem',     // 8px
        lg: '0.75rem',    // 12px
        xl: '1rem',       // 16px
        '2xl': '1.5rem',  // 24px
        full: '9999px',
    },

    typography: {
        fontFamily: {
            sans: 'Inter, system-ui, -apple-system, sans-serif',
        },
        fontSize: {
            xs: '0.75rem',      // 12px
            sm: '0.875rem',     // 14px
            base: '1rem',       // 16px
            lg: '1.125rem',     // 18px
            xl: '1.25rem',      // 20px
            '2xl': '1.5rem',    // 24px
            '3xl': '1.875rem',  // 30px
            '4xl': '2.25rem',   // 36px
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
        },
    },

    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },

    gradients: {
        primaryHeader: 'linear-gradient(to right, #0ea5e9, #06b6d4)', // sky-400 to cyan-500
        primaryCard: 'linear-gradient(to bottom right, #0ea5e9, #06b6d4)',
        successCard: 'linear-gradient(to bottom right, #10b981, #059669)',
        warningCard: 'linear-gradient(to bottom right, #f59e0b, #d97706)',
    },

    breakpoints: {
        mobile: '0px',
        tablet: '768px',
        desktop: '1024px',
        wide: '1280px',
    },

    transitions: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
    },
} as const

export type PelangganTheme = typeof pelangganTheme
