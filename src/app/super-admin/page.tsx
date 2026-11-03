import Link from "next/link"
import { getAdminOverviewMetrics } from "@/lib/db/admin-queries"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SuperAdminOverviewPage() {
  const stats = await getAdminOverviewMetrics()

  return (
    <div className="p-6 md:p-8 space-y-8 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
            Real-Time Analytics & Database Source of Truth
          </span>
          <h1 className="font-serif text-3xl font-bold text-neutral-900 mt-1">
            System Overview & Metrics
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/super-admin/orders">
            <button className="px-4 py-2 rounded-full bg-white border border-black/10 text-xs font-bold hover:bg-neutral-50 transition">
              View Transactions
            </button>
          </Link>
          <Link href="/super-admin/books/new">
            <button className="px-4 py-2 rounded-full bg-[#111111] text-white text-xs font-bold shadow-sm hover:bg-neutral-800 transition">
              + New Book
            </button>
          </Link>
        </div>
      </div>

      {/* Financial & Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-neutral-900">
            {formatCurrency(stats.grossSalesCents)}
          </div>
          <div className="text-[11px] text-neutral-500">
            {stats.ordersByStatus.paid} verified settlements captured
          </div>
        </div>

        {/* Net Revenue */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Sales</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-neutral-900">
            {formatCurrency(stats.netSalesCents)}
          </div>
          <div className="text-[11px] text-neutral-500">
            Gross Sales − Refunds ({formatCurrency(stats.refundTotalsCents)})
          </div>
        </div>

        {/* Total Orders Breakdown */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Orders</span>
            <ShoppingBag className="w-4 h-4 text-neutral-700" />
          </div>
          <div className="text-2xl font-bold font-serif text-neutral-900">
            {stats.totalOrders}
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-700 font-medium">{stats.ordersByStatus.paid} paid</span>
            <span>•</span>
            <span className="text-amber-700">{stats.ordersByStatus.pending} pending</span>
            {stats.ordersByStatus.refunded > 0 && (
              <>
                <span>•</span>
                <span className="text-purple-700">{stats.ordersByStatus.refunded} refunded</span>
              </>
            )}
          </div>
        </div>

        {/* Total Registered Readers */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Registered Readers</span>
            <Users className="w-4 h-4 text-neutral-700" />
          </div>
          <div className="text-2xl font-bold font-serif text-neutral-900">
            {stats.registeredReaders}
          </div>
          <div className="text-[11px] text-neutral-500">
            {stats.totalPublications} publications published live
          </div>
        </div>
      </div>

      {/* Grid: Recent Orders & Top Books */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders Table */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
            <h3 className="font-bold text-sm text-neutral-900">Recent Transactions</h3>
            <Link href="/super-admin/orders" className="text-xs font-semibold text-neutral-500 hover:text-black">
              View all ({stats.totalOrders})
            </Link>
          </div>

          {stats.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="divide-y divide-black/[0.04] flex-1">
              {stats.recentOrders.map((order) => {
                const bookTitle = order.order_items?.[0]?.book_title || "Digital Publication"
                return (
                  <div key={order.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {order.payments?.[0]?.razorpay_payment_id || "No gateway ref"}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-600 block font-medium truncate max-w-xs mt-0.5">
                        {bookTitle}
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        {order.customer_name || order.customer_email} • {formatDate(order.created_at)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-neutral-900 block font-mono">
                        {formatCurrency(order.total_cents, order.currency)}
                      </span>
                      <div className="mt-0.5">
                        {order.status === "paid" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-800 border-emerald-200">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                          </Badge>
                        ) : order.status === "pending" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-800 border-amber-200">
                            <Clock className="h-2.5 w-2.5" /> Pending
                          </Badge>
                        ) : order.status === "refunded" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-purple-50 text-purple-800 border-purple-200">
                            <RotateCcw className="h-2.5 w-2.5" /> Refunded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-neutral-600">
                            {order.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-400 italic">
              No orders recorded yet.
            </div>
          )}
        </div>

        {/* Top Performing Books */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
            <h3 className="font-bold text-sm text-neutral-900">Top Performing Titles</h3>
            <Link href="/super-admin/books" className="text-xs font-semibold text-neutral-500 hover:text-black">
              Manage books
            </Link>
          </div>

          {stats.topBooks && stats.topBooks.length > 0 ? (
            <div className="divide-y divide-black/[0.04] flex-1">
              {stats.topBooks.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="truncate pr-4">
                    <Link href={`/books/${b.slug}`} className="font-bold text-neutral-900 hover:underline block truncate">
                      {b.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                      <span>{formatCurrency(b.price_cents)}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold">{formatCurrency(b.net_sales_cents)} revenue</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-neutral-900 block font-mono">
                      {b.units_sold} {b.units_sold === 1 ? "unit sold" : "units sold"}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {b.unique_orders} {b.unique_orders === 1 ? "order" : "orders"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-400 italic">
              No sales data recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Recently Registered Readers */}
      <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
          <h3 className="font-bold text-sm text-neutral-900">Recently Registered Readers</h3>
          <Link href="/super-admin/users" className="text-xs font-semibold text-neutral-500 hover:text-black">
            View all readers ({stats.registeredReaders})
          </Link>
        </div>

        {stats.recentUsers && stats.recentUsers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="rounded-2xl bg-[#FAFAFA] border border-black/5 p-3.5 space-y-1">
                <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold font-serif">
                  {u.full_name?.charAt(0) || u.email?.charAt(0) || "U"}
                </div>
                <div className="font-bold text-xs text-neutral-900 truncate mt-2">
                  {u.full_name || "Reader"}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">{u.email}</div>
                {u.phone && <div className="text-[10px] text-neutral-500 font-mono">{u.phone}</div>}
                <div className="text-[9px] text-neutral-400 pt-1">{formatDate(u.created_at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-neutral-400 italic">
            No registered readers yet.
          </div>
        )}
      </div>
    </div>
  )
}
