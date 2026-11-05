import Link from "next/link"
import { redirect } from "next/navigation"
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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Orders & Receipts
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Verified payment transactions processed through Razorpay.
          </p>
        </div>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const payment = (order.payments as any[])?.[0]
            const items = (order.order_items as any[]) || []

            return (
              <div
                key={order.id}
                className="rounded-xl bg-white border border-neutral-200/80 p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
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
                <div className="space-y-1.5">
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
                  <div className="pt-2 text-[10px] text-neutral-400 font-mono flex items-center justify-between border-t border-neutral-100">
                    <span>Razorpay ID: {payment.razorpay_payment_id}</span>
                    <span>Payment: {payment.status}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-neutral-200/80 p-10 text-center max-w-md mx-auto shadow-2xs">
          <ShoppingBag className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">No Orders Yet</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Your transaction history and tax receipts will appear here once you purchase a book.
          </p>
          <Link href="/books" className="inline-block mt-4">
            <Button size="sm" className="rounded-lg text-xs font-semibold h-8 px-3.5 bg-neutral-900 text-white hover:bg-neutral-800">
              Browse Bookstore
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
