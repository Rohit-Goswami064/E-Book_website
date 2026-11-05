"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  Search,
  Bookmark,
  Library,
  User,
  Menu,
  X,
  Headphones,
  Gift,
  ShieldCheck,
  LogOut,
  ShoppingBag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface HeaderProps {
  user?: {
    id: string
    email?: string
    name?: string
  } | null
  isAdmin?: boolean
}

export function Header({ user: initialUser, isAdmin = false }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = React.useState(initialUser)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
        })
      } else {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      setIsSearchOpen(false)
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "search",
          metadata: { query: q, search_term: q },
        }),
      }).catch(() => {})
      router.push(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = "/"
  }

  const navLinks = [
    { name: "All Books", href: "/books" },
    { name: "Free Books", href: "/free-books", badge: "100% Free" },
    { name: "Audiobooks", href: "/categories/audiobooks" },
    { name: "Categories", href: "/categories/hindi-books" },
    { name: "Blog", href: "/blog" },
    { name: "About", href: "/about" },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#F6F5F2]/90 backdrop-blur-md border-b border-black/[0.06] transition-all">
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 h-[64px] sm:h-[72px] flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <Link href="/" className="flex items-center group shrink-0" aria-label="HiddenBooks Home">
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 transition-transform group-hover:scale-105 shrink-0">
                <Image
                  src="/hiddenbook_logo.png"
                  alt="HiddenBooks"
                  width={56}
                  height={56}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all relative",
                      isActive
                        ? "bg-[#111111] text-white font-semibold"
                        : "text-neutral-700 hover:text-black hover:bg-black/5"
                    )}
                  >
                    {link.name}
                    {link.badge && !isActive && (
                      <span className="ml-1.5 px-2 py-0.2 rounded-full text-[10px] bg-[#E8F5E9] text-[#1B5E20] font-bold border border-[#C8E6C9]">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Search Dialog Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center gap-2 h-9 w-9 sm:w-auto sm:h-10 px-0 sm:px-4 rounded-full bg-[#EFEFEF] hover:bg-[#E5E5E5] text-neutral-600 transition text-xs font-medium border border-black/5 shrink-0"
              aria-label="Search catalogue"
            >
              <Search className="w-4 h-4 text-neutral-500" />
              <span className="hidden sm:inline">Search titles, authors...</span>
              <kbd className="hidden md:inline-block ml-2 px-1.5 py-0.5 rounded bg-white text-[10px] font-mono border border-black/10 text-neutral-500">
                ⌘K
              </kbd>
            </button>

            {/* My Library Shortcut (When authenticated) */}
            {user && (
              <Link href="/account/library" className="hidden sm:flex">
                <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-xs font-semibold">
                  <Library className="w-4 h-4" />
                  My Library
                </Button>
              </Link>
            )}

            {/* Wishlist Shortcut */}
            <Link href="/account/wishlist" className="hidden sm:flex">
              <button
                className="w-10 h-10 rounded-full border border-black/10 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-700 transition"
                aria-label="Wishlist"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </Link>

            {/* User Account / Profile Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-full bg-white border border-black/10 hover:border-black/20 transition shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold max-w-[80px] truncate hidden md:inline">
                      {user.name || "Reader"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                  <DropdownMenuLabel className="px-2 py-1">
                    <div className="text-xs font-bold text-neutral-900 truncate">{user.name || "My Account"}</div>
                    <div className="text-[11px] text-neutral-500 font-normal truncate">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account/library" className="flex items-center gap-2">
                      <Library className="w-4 h-4" />
                      <span>My Library</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/orders" className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      <span>My Orders</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/wishlist" className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4" />
                      <span>Saved Books</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Account Settings</span>
                    </Link>
                  </DropdownMenuItem>

                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/super-admin" className="flex items-center gap-2 font-bold text-black">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Admin Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register" className="hidden sm:inline-flex">
                  <Button size="sm" className="rounded-full text-xs font-semibold bg-[#111111]">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-black/10 bg-white flex items-center justify-center text-neutral-700 shrink-0"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-black/10 px-4 sm:px-6 py-5 shadow-lg animate-in slide-in-from-top-2 max-h-[calc(100vh-64px)] overflow-y-auto">
            <nav className="flex flex-col gap-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-2.5 rounded-full text-sm font-semibold flex items-center justify-between",
                    pathname === link.href ? "bg-[#111111] text-white" : "hover:bg-neutral-100 text-neutral-800"
                  )}
                >
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] font-bold">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}

              <div className="h-px bg-neutral-100 my-2" />

              {user ? (
                <div className="flex flex-col gap-1 pt-1">
                  <div className="px-4 py-2.5 bg-neutral-50 rounded-2xl mb-1">
                    <div className="text-xs font-bold text-neutral-900 truncate">{user.name || "Reader"}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{user.email}</div>
                  </div>
                  <Link
                    href="/account/library"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-neutral-800 hover:bg-neutral-100"
                  >
                    <Library className="w-4 h-4 text-neutral-500" />
                    <span>My Library</span>
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-neutral-800 hover:bg-neutral-100"
                  >
                    <ShoppingBag className="w-4 h-4 text-neutral-500" />
                    <span>My Orders</span>
                  </Link>
                  <Link
                    href="/account/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-neutral-800 hover:bg-neutral-100"
                  >
                    <Bookmark className="w-4 h-4 text-neutral-500" />
                    <span>Saved Wishlist</span>
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-neutral-800 hover:bg-neutral-100"
                  >
                    <User className="w-4 h-4 text-neutral-500" />
                    <span>Account Settings</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/super-admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 text-emerald-700 hover:bg-emerald-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Super Admin Dashboard</span>
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      handleSignOut()
                    }}
                    className="mt-2 w-full px-4 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full text-xs h-10 rounded-full font-bold">Sign In</Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full text-xs h-10 rounded-full bg-[#111111] font-bold">Create Account</Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Global Search Dialog Modal */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-xl p-6 rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif font-bold">Search Catalogue</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSearchSubmit} className="mt-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or keyword (e.g. गोदान, Mindset)..."
                className="pl-11 pr-4 h-12 text-sm bg-[#F5F5F5] rounded-full"
                autoFocus
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-400 uppercase tracking-wider text-[11px] self-center">
                Popular:
              </span>
              {["गोदान", "शांत दिमाग", "उपन्यास", "स्व-सहायता", "Audiobooks", "Free"].map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => {
                    setIsSearchOpen(false)
                    router.push(`/search?q=${encodeURIComponent(tag)}`)
                  }}
                  className="px-3 py-1 rounded-full bg-[#F0EEE9] hover:bg-neutral-200 text-neutral-800 transition"
                >
                  {tag}
                </button>
              ))}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
