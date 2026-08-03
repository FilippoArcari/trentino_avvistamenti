// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Registra" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0d1117]/80 backdrop-blur-md border-b border-white/5">
      <span className="font-semibold text-lg tracking-tight text-white">
        Trentino Fauna
      </span>

      <div className="flex items-center gap-1">
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
    </nav>
  );
}
