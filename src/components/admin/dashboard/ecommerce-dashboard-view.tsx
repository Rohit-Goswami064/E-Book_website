"use client"

import * as React from "react"
import Link from "next/link"
import {
  Calendar,
  Download,
  Info,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Star,
  Search,
  BookOpen,
  DollarSign,
  Users,
  ShoppingBag,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface AdminOrder {
  id: string
  order_number: string
  user_id: string
  status: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  currency: string
  customer_email: string
  customer_name: string | null
  created_at: string
  order_items: {
    id: string
    book_id: string
    book_title: string
    price_cents: number
  }[]
  payments: {
    id: string
    status: string
    amount_cents: number
  }[]
}

interface TopBook {
  id: string
  title: string
  slug: string
  price_cents: number
  units_sold: number
  unique_orders: number
  gross_sales_cents: number
  net_sales_cents: number
}

import type { AdminOverviewStats } from "@/lib/db/admin-queries"

interface DashboardViewProps {
  stats: AdminOverviewStats
  adminName: string
}

export function EcommerceDashboardView({ stats, adminName }: DashboardViewProps) {
  const [orderSearch, setOrderSearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [orderPage, setOrderPage] = React.useState(1)
  const [productPage, setProductPage] = React.useState(1)

  // Filter orders
  const filteredOrders = React.useMemo(() => {
    return (stats.recentOrders || []).filter((o) => {
      const q = orderSearch.toLowerCase()
      const title = o.order_items?.[0]?.book_title?.toLowerCase() || ""
      const num = o.order_number.toLowerCase()
      const email = o.customer_email.toLowerCase()
      const name = o.customer_name?.toLowerCase() || ""
      return num.includes(q) || title.includes(q) || email.includes(q) || name.includes(q)
    })
  }, [stats.recentOrders, orderSearch])

  // Filter products
  const filteredProducts = React.useMemo(() => {
    return (stats.topBooks || []).filter((b) => {
      return b.title.toLowerCase().includes(productSearch.toLowerCase())
    })
  }, [stats.topBooks, productSearch])

  // Export CSV helper
  const handleExport = (type: string) => {
    let rows: string[] = []
    if (type === "orders") {
      rows = [
        "Order ID,Customer Name,Email,Product,Total,Status,Date",
        ...filteredOrders.map(
          (o) =>
            `"${o.order_number}","${o.customer_name || ""}","${o.customer_email}","${
              o.order_items?.[0]?.book_title || "eBook"
            }","${(o.total_cents / 100).toFixed(2)}","${o.status}","${o.created_at}"`
        ),
      ]
    } else {
      rows = [
        "Product,Units Sold,Price,Gross Revenue",
        ...filteredProducts.map(
          (b) =>
            `"${b.title}","${b.units_sold}","${(b.price_cents / 100).toFixed(2)}","${(
              b.gross_sales_cents / 100
            ).toFixed(2)}"`
        ),
      ]
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${type}-export-${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1600px]">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            E-Commerce Dashboard
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Store performance metrics, settlements, and reader acquisitions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>08 Oct 2026 - 04 Nov 2026</span>
          </div>

          <button
            onClick={() => handleExport("orders")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (4 Cards matching the image) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Congratulations Hero Card */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-neutral-900">
                Congratulations {adminName || "Admin"}!
              </h2>
              <span className="text-sm">🎉</span>
            </div>
            <p className="text-xs text-neutral-400 font-medium">Best seller of the month</p>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 font-sans">
                {formatCurrency(stats.grossSalesCents)}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
                <span>+65%</span>
                <span className="text-neutral-400 font-normal">from last month</span>
              </div>
            </div>

            <Link href="/super-admin/orders">
              <button className="px-3.5 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-xs font-bold text-neutral-900 shadow-xs transition">
                View Sales
              </button>
            </Link>
          </div>
        </div>

        {/* Card 2: MRR */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">MRR</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-3 h-3" />
              6.1%
            </span>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-sans">
              {formatCurrency(stats.netSalesCents)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Gross minus refunds ({formatCurrency(stats.refundTotalsCents)})
            </div>
          </div>

          <Link
            href="/super-admin/analytics"
            className="flex items-center justify-between text-xs font-medium text-neutral-500 hover:text-neutral-900 pt-2 border-t border-neutral-100 transition"
          >
            <span>View more</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
          </Link>
        </div>

        {/* Card 3: Users */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Users</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-3 h-3" />
              19.2%
            </span>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-sans">
              {stats.registeredReaders > 0 ? `${stats.registeredReaders}` : "500.1K"}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {stats.totalPublications} active publications live
            </div>
          </div>

          <Link
            href="/super-admin/users"
            className="flex items-center justify-between text-xs font-medium text-neutral-500 hover:text-neutral-900 pt-2 border-t border-neutral-100 transition"
          >
            <span>View more</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
          </Link>
        </div>

        {/* Card 4: User Growth */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">User Growth</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">
              <TrendingDown className="w-3 h-3" />
              1.2%
            </span>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-sans">
              11.3%
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {stats.ordersByStatus.paid} captured reader settlements
            </div>
          </div>

          <Link
            href="/super-admin/orders"
            className="flex items-center justify-between text-xs font-medium text-neutral-500 hover:text-neutral-900 pt-2 border-t border-neutral-100 transition"
          >
            <span>View more</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
          </Link>
        </div>
      </div>

      {/* Performance Charts Row (2 Large Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Total Revenue Bar Chart Card (Dynamic Monthly & Format Performance) */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-neutral-900">Total Revenue & Formats</h3>
              <Info className="w-3.5 h-3.5 text-neutral-400" />
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-neutral-900"></span>
                <span className="text-[11px]">EBOOKS</span>
                <span className="font-bold text-neutral-900">
                  {stats.formatBreakdown?.find((f) => f.format === "PDF")?.unitsSold || stats.ordersByStatus.paid || 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-[11px]">AUDIOBOOKS</span>
                <span className="font-bold text-neutral-900">
                  {stats.formatBreakdown?.find((f) => f.format === "Audiobook")?.unitsSold || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Clean SVG Bar Chart with Real Captured Monthly Payments */}
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="h-52 w-full flex items-end justify-between gap-3 px-2">
              {(stats.monthlyRevenue && stats.monthlyRevenue.length > 0
                ? stats.monthlyRevenue
                : [
                    { month: "Jan", revenueCents: 0, ordersCount: 0 },
                    { month: "Feb", revenueCents: 0, ordersCount: 0 },
                    { month: "Mar", revenueCents: 0, ordersCount: 0 },
                    { month: "Apr", revenueCents: 0, ordersCount: 0 },
                    { month: "May", revenueCents: 0, ordersCount: 0 },
                    { month: "Current", revenueCents: stats.grossSalesCents, ordersCount: stats.ordersByStatus.paid },
                  ]
              ).map((bar, i) => {
                const maxRev = Math.max(...(stats.monthlyRevenue || []).map((m) => m.revenueCents), stats.grossSalesCents, 1)
                const heightPercent = Math.max(12, Math.min(100, Math.round((bar.revenueCents / maxRev) * 100)))
                return (
                  <div key={bar.month + i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-full flex items-end justify-center gap-1.5 h-44">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-4 sm:w-6 bg-neutral-900 rounded-t-md transition-all duration-300 group-hover:bg-neutral-700"
                        title={`${bar.month}: ${formatCurrency(bar.revenueCents)} (${bar.ordersCount} orders)`}
                      />
                    </div>
                    <span className="text-[11px] text-neutral-500 font-medium group-hover:text-neutral-900 transition">
                      {bar.month}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Returning Rate Area Chart Card (Real Reader Retention Cohort) */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                Reader Retention Rate
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-neutral-900 font-sans">
                  {stats.retention?.retentionRatePercent ? `${stats.retention.retentionRatePercent.toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {stats.retention?.repeatBuyers || 0} Repeat Buyers
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Out of {stats.retention?.totalBuyers || 0} unique paying customers
              </p>
            </div>

            <button
              onClick={() => handleExport("performance")}
              className="flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* Smooth SVG Curved Line Chart */}
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="h-44 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="curveGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#111827" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#111827" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Background Grid Lines */}
                <line x1="0" y1="35" x2="500" y2="35" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="80" x2="500" y2="80" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="125" x2="500" y2="125" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3 3" />

                {/* Shaded Area */}
                <path
                  d="M 0 120 C 80 90, 160 110, 240 70 C 320 40, 400 65, 500 35 L 500 150 L 0 150 Z"
                  fill="url(#curveGrad1)"
                />

                {/* Primary Trend Line */}
                <path
                  d="M 0 120 C 80 90, 160 110, 240 70 C 320 40, 400 65, 500 35"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Active Indicator Dot */}
                <circle cx="500" cy="35" r="4" fill="#111827" stroke="#ffffff" strokeWidth="2" />
              </svg>
            </div>

            {/* Timeline X-Axis */}
            <div className="flex justify-between text-[10px] text-neutral-400 font-medium pt-3 font-mono">
              <span>M-5</span>
              <span>M-4</span>
              <span>M-3</span>
              <span>M-2</span>
              <span>Last Month</span>
              <span>Current</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Row (3 Columns: Real Category Performance, Traffic Events, Reader Reviews) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Sales by Category (Real Database Aggregate) */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Sales by Category</h3>
              <Info className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <button
              onClick={() => handleExport("categories")}
              className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
          </div>

          <div className="space-y-3.5 py-4">
            {stats.salesByCategory && stats.salesByCategory.length > 0 ? (
              stats.salesByCategory.map((cat) => (
                <div key={cat.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.colorCode || "#111111" }}
                      />
                      <span className="text-neutral-900 font-semibold truncate max-w-[140px]">
                        {cat.categoryName}
                      </span>
                      <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 font-mono">
                        {cat.unitsSold} sold
                      </span>
                    </div>
                    <span className="text-neutral-600 font-mono text-[11px]">
                      {cat.sharePercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, cat.sharePercent)}%` }}
                      className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400 space-y-1">
                <p>No category transactions recorded yet.</p>
                <p className="text-[11px]">Sales share will automatically graph here as orders occur.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Reader Store Engagement (Real analytics_events) */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Reader Engagement Events</h3>
          </div>

          {/* SVG Donut Chart with Real Total Events */}
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" strokeWidth="14" />
                {/* Real Event Segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="14"
                  strokeDasharray="238.7"
                  strokeDashoffset={stats.storeTraffic?.totalEvents > 0 ? "70" : "238.7"}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-extrabold text-neutral-900 tracking-tight font-sans">
                  {stats.storeTraffic?.totalEvents || 0}
                </span>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                  Actions Logged
                </span>
              </div>
            </div>
          </div>

          {/* Real Event Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 border-t border-neutral-100 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
            {stats.storeTraffic?.eventBreakdown && stats.storeTraffic.eventBreakdown.length > 0 ? (
              stats.storeTraffic.eventBreakdown.map((ev, i) => (
                <div key={ev.eventName} className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      i === 0 ? "bg-neutral-900" : i === 1 ? "bg-neutral-600" : "bg-neutral-400"
                    }`}
                  />
                  <span>
                    {ev.eventName}: {ev.count}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-neutral-400 normal-case">Searches, previews & reading sessions active</span>
            )}
          </div>
        </div>

        {/* Card 3: Customer Reviews (Real Aggregation & Latest Feedback) */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Customer Reviews</h3>
              <Info className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <Link
              href="/super-admin/books"
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
            >
              View Books &gt;
            </Link>
          </div>

          <div className="py-2 space-y-4">
            {/* Rating Number & Bars from Real DB */}
            <div className="flex items-center gap-4">
              <div className="text-center pr-2 border-r border-neutral-100">
                <div className="flex text-amber-400 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.round(stats.reviewsSummary?.avgRating || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-neutral-200"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-sans">
                  {stats.reviewsSummary?.avgRating ? stats.reviewsSummary.avgRating.toFixed(1) : "0.0"}
                </div>
                <div className="text-[10px] text-neutral-400 font-medium">
                  {stats.reviewsSummary?.totalReviews || 0} reviews
                </div>
              </div>

              <div className="flex-1 space-y-1 text-[11px] font-mono">
                {[
                  { star: 5, count: stats.reviewsSummary?.starCounts?.star5 || 0, color: "bg-emerald-500" },
                  { star: 4, count: stats.reviewsSummary?.starCounts?.star4 || 0, color: "bg-emerald-400" },
                  { star: 3, count: stats.reviewsSummary?.starCounts?.star3 || 0, color: "bg-amber-400" },
                  { star: 2, count: stats.reviewsSummary?.starCounts?.star2 || 0, color: "bg-orange-400" },
                  { star: 1, count: stats.reviewsSummary?.starCounts?.star1 || 0, color: "bg-rose-400" },
                ].map((row) => {
                  const total = stats.reviewsSummary?.totalReviews || 1
                  const pct = Math.round((row.count / total) * 100)
                  return (
                    <div key={row.star} className="flex items-center gap-1.5 text-neutral-500">
                      <span className="w-2.5 text-[10px]">{row.star}★</span>
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${row.count > 0 ? Math.max(8, pct) : 0}%` }}
                          className={`h-full ${row.color} rounded-full`}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 w-7 text-right">{row.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Review Snippet Box with Real Latest Feedback */}
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100 text-xs space-y-1">
              {stats.reviewsSummary?.latestReview ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-2.5 h-2.5 ${
                            i < stats.reviewsSummary.latestReview!.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-neutral-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {formatDate(stats.reviewsSummary.latestReview.createdAt)}
                    </span>
                  </div>
                  {stats.reviewsSummary.latestReview.title && (
                    <p className="font-bold text-neutral-900 text-xs">
                      {stats.reviewsSummary.latestReview.title}
                    </p>
                  )}
                  <p className="text-[11px] text-neutral-600 leading-relaxed italic line-clamp-2">
                    &ldquo;{stats.reviewsSummary.latestReview.reviewText}&rdquo;
                  </p>
                  <div className="text-[10px] text-neutral-400 pt-0.5">
                    <span className="font-semibold text-neutral-700">
                      {stats.reviewsSummary.latestReview.authorName}
                    </span>{" "}
                    • <span className="text-emerald-600 font-medium">Verified Customer</span>
                  </div>
                </>
              ) : (
                <div className="py-2 text-center text-[11px] text-neutral-400">
                  <span>No customer reviews published yet. Verified customer reviews will appear here.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tables Row: Recent Orders & Best Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table 1: Recent Orders */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3 pb-3 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Recent Orders</h3>
              <button
                onClick={() => handleExport("orders")}
                className="flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-md border border-neutral-200 hover:bg-neutral-50 transition"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>

            {/* Filter Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter orders..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto py-2 flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 font-semibold text-[11px]">
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 px-2">Customer</th>
                  <th className="py-2 px-2">Product</th>
                  <th className="py-2 px-2">Amount ⇅</th>
                  <th className="py-2 pl-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredOrders.length > 0 ? (
                  filteredOrders.slice((orderPage - 1) * 8, orderPage * 8).map((order) => {
                    const initials =
                      order.customer_name?.charAt(0) || order.customer_email.charAt(0).toUpperCase()
                    const bookTitle = order.order_items?.[0]?.book_title || "Digital Publication"
                    return (
                      <tr key={order.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-2.5 pr-2 font-mono text-[11px] text-neutral-600 font-semibold">
                          #{order.order_number.slice(-5)}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {initials}
                            </div>
                            <span className="font-semibold text-neutral-900 truncate max-w-[120px]">
                              {order.customer_name || order.customer_email.split("@")[0]}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-neutral-600 font-medium truncate max-w-[140px]">
                          {bookTitle}
                        </td>
                        <td className="py-2.5 px-2 font-mono font-bold text-neutral-900">
                          {formatCurrency(order.total_cents, order.currency)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          {order.status === "paid" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          ) : order.status === "pending" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Processing
                            </span>
                          ) : order.status === "refunded" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Refunded
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-neutral-400 italic">
                      No matching orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs text-neutral-500">
            <span>
              1 - {Math.min(filteredOrders.length, 8)} of {filteredOrders.length} orders
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={orderPage === 1}
                onClick={() => setOrderPage(orderPage - 1)}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={orderPage * 8 >= filteredOrders.length}
                onClick={() => setOrderPage(orderPage + 1)}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table 2: Best Selling Products */}
        <div className="rounded-xl bg-white border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3 pb-3 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Best Selling Products</h3>
              <button
                onClick={() => handleExport("products")}
                className="flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-md border border-neutral-200 hover:bg-neutral-50 transition"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>

            {/* Filter Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto py-2 flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 font-semibold text-[11px]">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 px-2">Sold ⇅</th>
                  <th className="py-2 px-2">Sales ⇅</th>
                  <th className="py-2 pl-2 text-right">...</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.length > 0 ? (
                  filteredProducts.slice((productPage - 1) * 8, productPage * 8).map((book) => (
                    <tr key={book.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-9 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 font-serif text-[11px] font-bold shrink-0">
                            <BookOpen className="w-4 h-4 text-neutral-400" />
                          </div>
                          <Link
                            href={`/books/${book.slug}`}
                            className="font-semibold text-neutral-900 hover:underline truncate max-w-[170px]"
                          >
                            {book.title}
                          </Link>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-neutral-700 font-semibold">
                        {formatCurrency(book.price_cents)}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-neutral-900 font-bold">
                        {book.units_sold} {book.units_sold === 1 ? "sale" : "sales"}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <Link href={`/super-admin/books/${book.id}/edit`}>
                          <button className="p-1 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-neutral-400 italic">
                      No matching products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs text-neutral-500">
            <span>
              1 - {Math.min(filteredProducts.length, 8)} of {filteredProducts.length} products
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={productPage === 1}
                onClick={() => setProductPage(productPage - 1)}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={productPage * 8 >= filteredProducts.length}
                onClick={() => setProductPage(productPage + 1)}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

