import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ShoppingBag, ChevronRight, CheckCircle2, Clock, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account/orders")
  }

  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // Fetch orders with payments and order items
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, status, total_cents, currency, created_at,
      order_items (book_id, book_title, price_cents),
      payments (provider, razorpay_payment_id, status)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="free">Paid & Verified</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "refunded":
        return <Badge variant="outline">Refunded</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: user.user_metadata?.full_name }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[880px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
          <Link href="/account" className="hover:text-black">Account</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">Order History</span>
        </nav>

        <div className="flex items-end justify-between border-b border-black/[0.06] pb-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-neutral-900">
              Orders & Receipts
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Verified payment transactions processed through Razorpay.
            </p>
          </div>
        </div>

        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => {
              const payment = (order.payments as any[])?.[0]
              const items = (order.order_items as any[]) || []

              return (
                <div
                  key={order.id}
                  className="rounded-[24px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.04]">
                    <div>
                      <div className="font-mono text-xs font-bold text-neutral-800">
                        {order.order_number}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                      <span className="font-bold text-sm text-neutral-900 ml-2">
                        {formatCurrency(order.total_cents, order.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-800">{item.book_title}</span>
                        <span className="text-neutral-500">
                          {formatCurrency(item.price_cents, order.currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Payment provider metadata */}
                  {payment?.razorpay_payment_id && (
                    <div className="pt-2 text-[10px] text-neutral-400 font-mono flex items-center justify-between border-t border-black/[0.04]">
                      <span>Razorpay ID: {payment.razorpay_payment_id}</span>
                      <span>Payment: {payment.status}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
            <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-neutral-800">No Orders Yet</h3>
            <p className="text-xs text-neutral-500 mt-2">
              Your transaction history and tax receipts will appear here once you purchase a book.
            </p>
            <Link href="/books" className="inline-block mt-4">
              <Button size="sm" className="rounded-full bg-[#111111]">
                Browse Store
              </Button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
