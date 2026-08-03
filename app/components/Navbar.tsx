// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Registra" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/coda", label: "Coda Offline" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#0d1117]/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold text-lg tracking-tight text-white">
          Trentino Fauna
        </span>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[#4a7c59]/20 text-[#6ab07a] border border-[#4a7c59]/30"
                    : "text-[#8b9ab3] hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 -mr-2 rounded-lg text-[#8b9ab3] hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0d1117]">
          <div className="flex flex-col px-4 py-3 gap-2">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    active
                      ? "bg-[#4a7c59]/20 text-[#6ab07a] border border-[#4a7c59]/30"
                      : "text-[#8b9ab3] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
