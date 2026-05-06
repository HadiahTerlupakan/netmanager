"use client";

import { useTheme } from "next-themes";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi2";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme ?? "dark";
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 neumorphic-soft rounded-full transition-all duration-300 focus-enhanced mobile-touch-target"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {/* Track */}
      <div
        className={`absolute inset-1 rounded-full transition-all duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-r from-primary to-primary/80"
            : "bg-gradient-to-r from-amber-300 to-orange-400"
        }`}
      />

      {/* Thumb */}
      <div
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
          theme === "dark" ? "left-8" : "left-1"
        }`}
      >
        {/* Icon */}
        <span className="text-xs">
          {theme === "dark" ? (
            <HiOutlineMoon className="w-3 h-3 text-primary" />
          ) : (
            <HiOutlineSun className="w-3 h-3 text-amber-500" />
          )}
        </span>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 rounded-full opacity-0 hover:opacity-10 bg-white transition-opacity duration-200" />
    </button>
  );
}
