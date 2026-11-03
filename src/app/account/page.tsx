import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, getUserRole } from "@/lib/auth/roles"
import {
  Library,
  ShoppingBag,
  Download,
  Bookmark,
  Settings,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
  User,
  LogOut,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AccountOverviewPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account")
  }

  const isAdmin = await isCurrentUserAdmin()
  const role = await getUserRole(user.id)
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
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: displayName }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[840px] w-full mx-auto px-4 sm:px-6 py-8 md:py-14 space-y-6">
        {/* Profile Card Header matching Reference 2 */}
        <div className="rounded-[28px] sm:rounded-[32px] bg-white border border-black/[0.06] p-5 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#111111] text-white flex items-center justify-center text-xl sm:text-2xl font-bold font-serif shadow-sm shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-xl sm:text-3xl font-bold text-neutral-900 truncate">
                  {displayName}
                </h1>
                <p className="text-xs text-neutral-500 mt-0.5 truncate">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAFAFA] border border-black/5 text-neutral-700">
                    {libraryCount || 0} Books in Library
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAFAFA] border border-black/5 text-neutral-700">
                    {orderCount || 0} Orders
                  </span>
                  {role !== "customer" && (
                    <span className="px-2.5 py-0.5 rounded-full bg-black text-white">
                      {role.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link href="/account/settings" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto justify-center h-9 px-4 rounded-full border border-black/10 hover:bg-neutral-50 text-xs font-semibold flex items-center gap-1.5 transition">
                <Settings className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </Link>
          </div>
        </div>

        {/* WhatsApp Direct Buy Support Card (matching Reference 2) */}
        <div className="rounded-[24px] bg-[#111111] text-white p-5 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <div className="font-bold text-sm">Direct Reader Desk & Book Inquiries</div>
            <p className="text-xs text-neutral-400">
              Assistance with formats, orders, and offline PDF access on WhatsApp.
            </p>
          </div>
          <a
            href="https://wa.me/917383138396"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shrink-0 ml-4"
          >
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </a>
        </div>

        {/* Account Quick Navigation List */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400 px-2">
            Library & Purchases
          </div>
          <div className="rounded-[24px] bg-white border border-black/[0.06] divide-y divide-black/[0.04] overflow-hidden shadow-sm">
            <Link
              href="/account/library"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <Library className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-neutral-900">My Library</div>
                  <div className="text-[11px] text-neutral-500">Read online and view your book collection</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>

            <Link
              href="/account/orders"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-neutral-900">Order History</div>
                  <div className="text-[11px] text-neutral-500">View payment receipts and transaction records</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>

            <Link
              href="/account/downloads"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-neutral-900">Authorized Downloads</div>
                  <div className="text-[11px] text-neutral-500">Download offline PDFs for entitled titles</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>

            <Link
              href="/account/wishlist"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-neutral-900">Saved Wishlist</div>
                  <div className="text-[11px] text-neutral-500">Books saved for future reading</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>
          </div>
        </div>

        {/* Administration (if Admin) */}
        {isAdmin && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400 px-2">
              Management
            </div>
            <div className="rounded-[24px] bg-white border border-black/[0.06] overflow-hidden shadow-sm">
              <Link
                href="/super-admin"
                className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-neutral-900">Super Admin Panel</div>
                    <div className="text-[11px] text-neutral-500">Manage books, orders, users, and analytics</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </Link>
            </div>
          </div>
        )}

        {/* Support Section */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400 px-2">
            Help & Information
          </div>
          <div className="rounded-[24px] bg-white border border-black/[0.06] divide-y divide-black/[0.04] overflow-hidden shadow-sm">
            <Link
              href="/faq"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-neutral-900">Frequently Asked Questions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>

            <Link
              href="/about"
              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center text-neutral-800">
                  <User className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-neutral-900">About HiddenBooks Publishing</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
