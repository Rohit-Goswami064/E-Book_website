import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Library,
  ShoppingBag,
  Download,
  Bookmark,
  Settings,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  User,
  ArrowRight,
  BookOpen,
  Sparkles,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AccountOverviewPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account")
  }

  const isAdmin = await isCurrentUserAdmin()
  const role = await getUserRole(user.id)

  // Security Policy: Super Admin & Admin are strictly redirected to /super-admin and cannot open reader user dashboard
  if (isAdmin || role === "super_admin" || role === "admin") {
    redirect("/super-admin")
  }

  const supabase = await createClient()

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  // 2. Fetch count of user's active library books
  const { count: libraryCount } = await supabase
    .from("book_entitlements")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_revoked", false)

  // 3. Fetch count of orders
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)

  const displayName = profile?.full_name || user.user_metadata?.full_name || "Reader"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-neutral-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Reader Dashboard
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage your personal digital library, invoices, downloads, and reading preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/books">
            <Button variant="outline" size="sm" className="rounded-lg text-xs font-medium h-8 px-3 border-neutral-200 hover:bg-neutral-50">
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-neutral-500" />
              Browse Catalogue
            </Button>
          </Link>
          <Link href="/account/settings">
            <Button size="sm" className="rounded-lg text-xs font-medium h-8 px-3 bg-neutral-900 text-white hover:bg-neutral-800">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* User Identity Profile Card */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div className="size-13 rounded-full bg-neutral-900 text-white flex items-center justify-center text-lg font-bold ring-4 ring-neutral-100 shrink-0 overflow-hidden shadow-2xs">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="size-full object-cover"
                />
              ) : (
                initial
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                  {displayName}
                </h2>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.2 font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-50 border-neutral-200">
                  Reader
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 truncate mt-0.5">{user.email}</p>

              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="secondary" className="gap-1.5 text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60">
                  <BookOpen className="w-3 h-3 text-neutral-500" />
                  <span>{libraryCount || 0} Books</span>
                </Badge>
                <Badge variant="secondary" className="gap-1.5 text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60">
                  <ShoppingBag className="w-3 h-3 text-neutral-500" />
                  <span>{orderCount || 0} Orders</span>
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link href="/account/settings">
              <Button variant="outline" size="sm" className="rounded-lg text-xs font-medium h-8 px-3 border-neutral-200 hover:bg-neutral-50">
                <Settings className="w-3.5 h-3.5 mr-1.5 text-neutral-500" />
                Account Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Access Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Library */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-neutral-500">
              My Library
            </span>
            <div className="p-1.5 rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
              <Library className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">{libraryCount || 0}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Purchased & claimed titles
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100">
            <Link
              href="/account/library"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition"
            >
              <span>Open reader library</span>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>

        {/* Card 2: Orders */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-neutral-500">
              Orders
            </span>
            <div className="p-1.5 rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">{orderCount || 0}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Invoices & payment records
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100">
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition"
            >
              <span>View receipts</span>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>

        {/* Card 3: Downloads */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-neutral-500">
              Downloads
            </span>
            <div className="p-1.5 rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">PDFs</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Offline reader access
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100">
            <Link
              href="/account/downloads"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition"
            >
              <span>Download offline</span>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>

        {/* Card 4: Wishlist */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-neutral-500">
              Wishlist
            </span>
            <div className="p-1.5 rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
              <Bookmark className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">Saved</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Books saved for later
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100">
            <Link
              href="/account/wishlist"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition"
            >
              <span>View wishlist</span>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>
      </div>

      {/* WhatsApp Direct Buy Support Banner */}
      <div className="rounded-xl bg-neutral-900 text-neutral-100 border border-neutral-800/80 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <div className="font-semibold text-xs sm:text-sm flex items-center gap-2 text-white">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Direct Reader Desk & Book Inquiries</span>
          </div>
          <p className="text-[11px] sm:text-xs text-neutral-400 max-w-xl leading-normal">
            Instant assistance with reading formats, book recommendations, and purchase orders on WhatsApp.
          </p>
        </div>
        <a
          href="https://wa.me/917383138396"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold shadow-2xs transition-colors shrink-0"
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Contact Reader Desk</span>
        </a>
      </div>

      {/* 2-Column Dashboard Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Column 1: Library & Orders Management */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-2xs overflow-hidden">
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-neutral-100">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">Library & Orders</h3>
            <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
              Access your digital reading shelf, transaction receipts, and offline assets.
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            <Link
              href="/account/library"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <Library className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">My Library</div>
                  <div className="text-[11px] text-neutral-500">Read online and view your book collection</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/account/orders"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Order History</div>
                  <div className="text-[11px] text-neutral-500">View payment receipts and transaction records</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/account/downloads"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Authorized Downloads</div>
                  <div className="text-[11px] text-neutral-500">Download offline PDFs for entitled titles</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/account/wishlist"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <Bookmark className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Saved Wishlist</div>
                  <div className="text-[11px] text-neutral-500">Books saved for future reading</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>

        {/* Column 2: Account Settings & Support */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-2xs overflow-hidden">
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-neutral-100">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">Account & Support</h3>
            <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
              Manage your profile, browse FAQ help desk, and explore bookstore.
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            <Link
              href="/account/settings"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Profile & Settings</div>
                  <div className="text-[11px] text-neutral-500">Update password, full name, and preferences</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/account/faq"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Frequently Asked Questions</div>
                  <div className="text-[11px] text-neutral-500">Help with file formats, reader sync, and payments</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/free-books"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">Free Books Edition</div>
                  <div className="text-[11px] text-neutral-500">Browse 100% free downloadable literature</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/about"
              className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-neutral-900">About HiddenBooks</div>
                  <div className="text-[11px] text-neutral-500">Our publishing mission and editorial curation</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
