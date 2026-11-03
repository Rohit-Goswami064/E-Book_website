"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Grid3X3, Library, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()

  // Hide mobile bottom nav on reader page to keep full screen immersion
  if (pathname.startsWith("/read/")) {
    return null
  }

  const items = [
    { label: "Home", href: "/", icon: Home, exact: true },
    { label: "Browse", href: "/books", icon: Grid3X3, exact: false },
    { label: "Library", href: "/account/library", icon: Library, exact: false },
    { label: "Profile", href: "/account", icon: User, exact: false },
  ]

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/[0.08] px-3 py-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-1 min-w-[64px] py-1 transition-transform active:scale-95"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                isActive
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-neutral-500 hover:text-black hover:bg-black/5"
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span
              className={cn(
                "text-[10px] tracking-tight font-medium leading-none",
                isActive ? "font-bold text-black" : "text-neutral-500"
              )}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
