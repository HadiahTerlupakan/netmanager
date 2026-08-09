"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          // Soft-tinted indigo, konsisten antara light & dark
          "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 hover:-translate-y-px active:translate-y-0 active:bg-indigo-200 " +
          "dark:bg-transparent dark:text-white dark:border-indigo-500/25 dark:hover:bg-indigo-500/10 dark:hover:border-indigo-400/40",

        primary:
          // Solid, prominent untuk CTA utama
          "bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 hover:-translate-y-px active:translate-y-0 active:bg-indigo-800 shadow-sm " +
          "dark:bg-indigo-600 dark:text-white dark:border-indigo-600 dark:hover:bg-indigo-500 dark:hover:border-indigo-500 dark:active:bg-indigo-700",

        destructive:
          "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 hover:-translate-y-px active:translate-y-0 active:bg-red-200 " +
          "dark:bg-transparent dark:text-white dark:border-red-500/25 dark:hover:bg-red-500/10 dark:hover:border-red-400/40",

        success:
          "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 hover:-translate-y-px active:translate-y-0 active:bg-green-200 " +
          "dark:bg-transparent dark:text-white dark:border-green-500/25 dark:hover:bg-green-500/10 dark:hover:border-green-400/40",

        warning:
          "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:-translate-y-px active:translate-y-0 active:bg-amber-200 " +
          "dark:bg-transparent dark:text-white dark:border-amber-500/25 dark:hover:bg-amber-500/10 dark:hover:border-amber-400/40",

        outline:
          // Light: clean border with dark text. Dark: subtle border with white text
          "border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100 hover:border-neutral-400 active:bg-neutral-200 " +
          "dark:border-white/[0.06] dark:text-white dark:hover:bg-white/5 dark:hover:border-white/15 dark:active:bg-white/10",

        secondary:
          "bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200 hover:border-neutral-300 active:bg-neutral-300 " +
          "dark:bg-white/[0.03] dark:text-white dark:border-white/[0.06] dark:hover:bg-white/10 dark:hover:border-white/10",

        ghost:
          "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 " +
          "dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white dark:active:bg-neutral-700",

        link:
          "text-indigo-600 underline-offset-4 hover:underline hover:text-indigo-700 " +
          "dark:text-indigo-400 dark:hover:text-indigo-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-1 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
