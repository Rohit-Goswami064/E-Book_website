"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Library,
  ShoppingBag,
  Download,
  Bookmark,
  Settings,
  Store,
  Sparkles,
  HelpCircle,
  MessageCircle,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface UserLayoutShellProps {
  user: {
    id: string
    email?: string
    name?: string
    avatar_url?: string | null
  }
  libraryCount?: number
  orderCount?: number
  children: React.ReactNode
}

export function UserLayoutShell({
  user,
  libraryCount = 0,
  orderCount = 0,
  children,
}: UserLayoutShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const displayName = user.name || "Reader"
  const initial = displayName.charAt(0).toUpperCase()

  const getPageTitle = (path: string) => {
    if (path.startsWith("/account/library")) return "My Library"
    if (path.startsWith("/account/orders")) return "Order History"
    if (path.startsWith("/account/downloads")) return "Authorized Downloads"
    if (path.startsWith("/account/wishlist")) return "Saved Wishlist"
    if (path.startsWith("/account/settings")) return "Account Settings"
    if (path.startsWith("/account/faq")) return "Help & FAQs"
    return null
  }
  const currentSubPage = getPageTitle(pathname)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const navGroups = [
    {
      title: "Reading & Shelf",
      items: [
        {
          name: "Dashboard",
          href: "/account",
          icon: LayoutDashboard,
          active: pathname === "/account",
        },
        {
          name: "My Library",
          href: "/account/library",
          icon: Library,
          active: pathname === "/account/library",
          badge: libraryCount > 0 ? String(libraryCount) : undefined,
        },
        {
          name: "Order History",
          href: "/account/orders",
          icon: ShoppingBag,
          active: pathname === "/account/orders",
          badge: orderCount > 0 ? String(orderCount) : undefined,
        },
        {
          name: "Authorized Downloads",
          href: "/account/downloads",
          icon: Download,
          active: pathname === "/account/downloads",
        },
        {
          name: "Saved Wishlist",
          href: "/account/wishlist",
          icon: Bookmark,
          active: pathname === "/account/wishlist",
        },
      ],
    },
    {
      title: "Account & Bookstore",
      items: [
        {
          name: "Account Settings",
          href: "/account/settings",
          icon: Settings,
          active: pathname === "/account/settings",
        },
        {
          name: "Explore Bookstore",
          href: "/books",
          icon: Store,
          active: false,
        },
        {
          name: "Free Books",
          href: "/free-books",
          icon: Sparkles,
          active: false,
          badge: "Free",
        },
        {
          name: "Help & FAQs",
          href: "/account/faq",
          icon: HelpCircle,
          active: pathname === "/account/faq" || pathname === "/faq",
        },
      ],
    },
  ]

  return (
    <div className="h-screen w-full bg-[#F8F9FA] text-neutral-900 flex overflow-hidden font-sans antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 md:hidden transition-opacity"
        />
      )}

      {/* Persistent Left Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-neutral-200/80 transition-all duration-200 z-50 flex flex-col justify-between shrink-0 h-full fixed md:relative",
          // Mobile state
          mobileMenuOpen ? "left-0 w-64 shadow-2xl" : "-left-64 md:left-0",
          // Desktop state
          sidebarOpen ? "md:w-64" : "md:w-16 overflow-hidden"
        )}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 border-b border-neutral-200/80 flex items-center justify-between shrink-0">
          {sidebarOpen ? (
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg overflow-hidden relative bg-white border border-neutral-200 shadow-xs shrink-0">
                <Image
                  src="/hiddenbook_logo.png"
                  alt="HiddenBooks Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div className="leading-tight truncate">
                <span className="font-bold text-sm tracking-tight text-neutral-900 block leading-none">
                  HiddenBooks
                </span>
                <span className="text-[10px] text-neutral-400 block font-medium mt-0.5">
                  Reader Dashboard
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/" className="mx-auto block" title="HiddenBooks">
              <div className="size-8 rounded-lg overflow-hidden relative bg-white border border-neutral-200 shadow-xs shrink-0">
                <Image
                  src="/hiddenbook_logo.png"
                  alt="HiddenBooks Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
          )}

          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 md:hidden"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Independent Scroll) */}
        <div className="p-3 space-y-4 overflow-y-auto flex-1">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {sidebarOpen && (
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors group",
                        item.active
                          ? "bg-neutral-900 text-white font-semibold shadow-xs"
                          : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900"
                      )}
                      title={!sidebarOpen ? item.name : undefined}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          item.active ? "text-white" : "text-neutral-500 group-hover:text-neutral-900"
                        )}
                      />
                      {sidebarOpen && (
                        <div className="flex-1 flex items-center justify-between">
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.2 rounded-md font-semibold",
                                item.active
                                  ? "bg-white/20 text-white"
                                  : "bg-neutral-100 text-neutral-700 border border-neutral-200/60"
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: WhatsApp Desk & Profile / Signout */}
        <div className="p-3 border-t border-neutral-200/80 space-y-2 bg-neutral-50/60 shrink-0">
          {sidebarOpen ? (
            <>
              {/* WhatsApp Quick Help */}
              <a
                href="https://wa.me/917383138396"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200/60 text-emerald-800 transition text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Reader Desk</span>
                </div>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </a>

              {/* User Profile Card & Sign out */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/80 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={displayName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-neutral-900 truncate leading-tight">{displayName}</div>
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1.5 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header Bar (Fixed) */}
        <header className="h-14 shrink-0 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
              title="Toggle Sidebar"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
              title="Open Navigation"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Breadcrumb Info */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Link href="/" className="hover:text-neutral-900 transition font-medium">
                HiddenBooks
              </Link>
              <ChevronRight className="w-3 h-3 text-neutral-400" />
              {currentSubPage ? (
                <>
                  <Link href="/account" className="hover:text-neutral-900 transition font-medium">
                    Dashboard
                  </Link>
                  <ChevronRight className="w-3 h-3 text-neutral-400" />
                  <span className="text-neutral-900 font-semibold">{currentSubPage}</span>
                </>
              ) : (
                <span className="text-neutral-900 font-semibold">Reader Dashboard</span>
              )}
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2.5">
            <Link href="/books">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-medium border-neutral-200 hover:bg-neutral-50"
              >
                <Store className="w-3.5 h-3.5 mr-1.5 text-neutral-500" />
                <span className="hidden sm:inline">Bookstore</span>
              </Button>
            </Link>

            <Link href="/free-books">
              <Button
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#E8F5E9] text-[#1B5E20] hover:bg-[#C8E6C9]/50 border border-[#C8E6C9]"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#1B5E20]" />
                <span className="hidden sm:inline">100% Free Books</span>
              </Button>
            </Link>

            {/* Avatar Pill */}
            <Link href="/account/settings" className="flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Inner Content with Clean Dedicated Scroll */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">
          <div className="max-w-6xl w-full mx-auto pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
