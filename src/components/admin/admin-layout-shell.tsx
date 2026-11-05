"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BookOpen,
  ShoppingBag,
  Users,
  FileText,
  Tags,
  Percent,
  Sliders,
  BarChart3,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Store,
  ArrowUpRight,
  LogOut,
  Sparkles,
  Command,
  PanelLeftClose,
  PanelLeft,
  Download,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react"

interface AdminLayoutShellProps {
  user: {
    id: string
    email?: string
    role?: string
    name?: string
  }
  children: React.ReactNode
}

export function AdminLayoutShell({ user, children }: AdminLayoutShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [ecommerceOpen, setEcommerceOpen] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [storeDropdownOpen, setStoreDropdownOpen] = React.useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false)

  // Navigation structure mimicking the Shadcn UI Kit
  const navGroups = [
    {
      title: "Dashboards",
      items: [
        {
          name: "E-Commerce",
          icon: ShoppingBag,
          isExpandable: true,
          isOpen: ecommerceOpen,
          onToggle: () => setEcommerceOpen(!ecommerceOpen),
          children: [
            { name: "Dashboard", href: "/super-admin", active: pathname === "/super-admin" },
            { name: "Product Catalog", href: "/super-admin/books", active: pathname === "/super-admin/books" },
            { name: "Add Book", href: "/super-admin/books/new", active: pathname === "/super-admin/books/new" },
            { name: "Order List", href: "/super-admin/orders", active: pathname === "/super-admin/orders" },
          ],
        },
        {
          name: "Analytics",
          icon: BarChart3,
          href: "/super-admin/analytics",
          active: pathname === "/super-admin/analytics",
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          name: "Users & Roles",
          icon: Users,
          href: "/super-admin/users",
          active: pathname === "/super-admin/users",
        },
        {
          name: "Editorial Blog",
          icon: FileText,
          href: "/super-admin/blog",
          active: pathname.startsWith("/super-admin/blog"),
        },
        {
          name: "Categories",
          icon: Tags,
          href: "/super-admin/categories",
          active: pathname === "/super-admin/categories",
        },
        {
          name: "Authors",
          icon: Users,
          href: "/super-admin/authors",
          active: pathname === "/super-admin/authors",
        },
        {
          name: "Coupons",
          icon: Percent,
          href: "/super-admin/coupons",
          active: pathname === "/super-admin/coupons",
        },
        {
          name: "Homepage CMS",
          icon: Sliders,
          href: "/super-admin/cms",
          active: pathname === "/super-admin/cms",
        },
      ],
    },
  ]

  const userInitial = user.name?.charAt(0) || user.email?.charAt(0).toUpperCase() || "A"

  return (
    <div className="h-screen bg-[#F8F9FA] text-neutral-900 flex flex-col font-sans antialiased overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm z-40 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
            title="Toggle Sidebar"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          {/* Store Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-100/80 hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition border border-neutral-200/60"
            >
              <div className="w-4 h-4 rounded-full overflow-hidden relative bg-white border border-neutral-300 shrink-0">
                <Image
                  src="/hiddenbook_logo.png"
                  alt="HiddenBooks"
                  width={16}
                  height={16}
                  className="w-full h-full object-cover"
                />
              </div>
              <span>HiddenBooks Outlet</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {storeDropdownOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 z-50 text-xs">
                <div className="px-2.5 py-1.5 font-semibold text-[11px] text-neutral-400 uppercase tracking-wider">
                  Select Storefront
                </div>
                <button
                  onClick={() => setStoreDropdownOpen(false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg font-medium text-neutral-900 bg-neutral-100 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    HiddenBooks Primary (Production)
                  </span>
                  <span className="text-[10px] text-neutral-400">Active</span>
                </button>
                <div className="my-1 border-t border-neutral-100" />
                <Link
                  href="/"
                  target="_blank"
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Open Public Storefront</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Icons & User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>

          <button
            className="relative p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </button>

          <div className="h-4 w-[1px] bg-neutral-200 mx-1 hidden sm:block"></div>

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-neutral-100 transition"
            >
              <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold ring-2 ring-neutral-200">
                {userInitial}
              </div>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 z-50 text-xs">
                <div className="p-2 border-b border-neutral-100 mb-1">
                  <div className="font-bold text-neutral-900 truncate">{user.name || "Administrator"}</div>
                  <div className="text-neutral-500 text-[11px] truncate">{user.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {user.role || "super_admin"}
                  </div>
                </div>
                <Link
                  href="/account"
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-700 hover:bg-neutral-50 font-medium"
                >
                  <Users className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Account Profile</span>
                </Link>
                <Link
                  href="/account/settings"
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-700 hover:bg-neutral-50 font-medium"
                >
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Settings</span>
                </Link>
                <div className="my-1 border-t border-neutral-100" />
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`bg-white border-r border-neutral-200/80 transition-all duration-200 flex flex-col justify-between shrink-0 z-30 h-full overflow-hidden ${
            sidebarOpen ? "w-64" : "w-0 md:w-16 overflow-hidden"
          }`}
        >
          <div className="p-3.5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Brand Header */}
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5 px-2 py-1">
                <div className="w-8 h-8 rounded-lg overflow-hidden relative bg-white border border-neutral-200 shadow-xs shrink-0">
                  <Image
                    src="/hiddenbook_logo.png"
                    alt="HiddenBooks Logo"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="leading-tight">
                  <span className="font-bold text-sm tracking-tight text-neutral-900 block">
                    HiddenBooks
                  </span>
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    Super Admin Console
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <div className="w-8 h-8 rounded-lg overflow-hidden relative bg-white border border-neutral-200 shrink-0">
                  <Image
                    src="/hiddenbook_logo.png"
                    alt="HiddenBooks Logo"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Search Input Box */}
            {sidebarOpen && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-neutral-100/70 border border-neutral-200/60 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-neutral-400 bg-white border border-neutral-200 px-1 py-0.5 rounded">
                  ⌘K
                </kbd>
              </div>
            )}

            {/* Navigation Groups */}
            <div className="space-y-4 pt-1">
              {navGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  {sidebarOpen && (
                    <div className="px-2.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {group.title}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      if (item.isExpandable) {
                        return (
                          <div key={item.name} className="space-y-0.5">
                            <button
                              onClick={item.onToggle}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                item.isOpen
                                  ? "text-neutral-900 bg-neutral-100/60"
                                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Icon className="w-4 h-4 text-neutral-500" />
                                {sidebarOpen && <span>{item.name}</span>}
                              </div>
                              {sidebarOpen && (
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                                    item.isOpen ? "rotate-0" : "-rotate-90"
                                  }`}
                                />
                              )}
                            </button>

                            {sidebarOpen && item.isOpen && item.children && (
                              <div className="pl-6 space-y-0.5 pt-0.5">
                                {item.children.map((child) => (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={`block px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                                      child.active
                                        ? "bg-neutral-900 text-white font-semibold shadow-xs"
                                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                                    }`}
                                  >
                                    {child.name}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href!}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                            item.active
                              ? "bg-neutral-900 text-white shadow-xs"
                              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${item.active ? "text-white" : "text-neutral-500"}`} />
                          {sidebarOpen && <span>{item.name}</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Card */}
          {sidebarOpen && (
            <div className="p-3.5 border-t border-neutral-200/80 shrink-0">
              <div className="rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-50 border border-neutral-200/80 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">HiddenBooks Pro</div>
                    <div className="text-[10px] text-neutral-500">Live Production v2.0</div>
                  </div>
                </div>
                <Link
                  href="/"
                  className="block w-full py-1.5 text-center rounded-lg bg-neutral-900 text-white text-[11px] font-bold hover:bg-neutral-800 transition"
                >
                  Return to Storefront
                </Link>
              </div>
            </div>
          )}
        </aside>

        {/* Workspace Content Area */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

