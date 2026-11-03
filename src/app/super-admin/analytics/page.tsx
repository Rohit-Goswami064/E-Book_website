"use client"

import * as React from "react"
import { BarChart3, TrendingUp, Users, Eye, ShoppingCart, BookOpen, Search, Heart, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface AnalyticsData {
  metrics: {
    totalPageViews: number
    uniqueSessions: number
    bookViews: number
    checkoutsInitiated: number
    completedPurchases: number
    readerSessions: number
    wishlistAdds: number
    conversionRate: string
  }
  topBooks: { id: string; title: string; views: number }[]
  topSearches: { query: string; count: number }[]
}

export default function AdminAnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [range, setRange] = React.useState("30d")

  const fetchAnalytics = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/analytics?range=${range}`)
      const resData = await res.json()
      if (res.ok) {
        setData(resData)
      } else {
        toast.error(resData.error || "Failed to load analytics")
      }
    } catch {
      toast.error("Network error loading analytics")
    } finally {
      setLoading(false)
    }
  }, [range])

  React.useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return (
    <div className="h-full flex flex-col p-6 space-y-5 overflow-auto">
      {/* Header - Compact for 80/20 ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">
            Store & Reader Analytics
          </h1>
          <p className="text-xs text-neutral-500">
            Real customer event logs, checkout funnel rates, and reader engagement.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-neutral-200">
          {[
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "90 Days" },
            { id: "all", label: "All Time" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                range === r.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-400">Loading live analytics data...</div>
      ) : data ? (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Page Views</span>
                  <Eye className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-neutral-900">
                  {data.metrics.totalPageViews}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {data.metrics.uniqueSessions} unique sessions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Book Views</span>
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-neutral-900">
                  {data.metrics.bookViews}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {data.metrics.wishlistAdds} wishlist additions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Checkout Funnel</span>
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-neutral-900">
                  {data.metrics.checkoutsInitiated}
                </div>
                <p className="text-[11px] text-emerald-700 font-mono mt-1">
                  {data.metrics.completedPurchases} paid orders
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Conversion Rate</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-700">
                  {data.metrics.conversionRate}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Checkout to purchase
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel */}
          <Card className="bg-white border-neutral-200 shadow-xs">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-serif font-bold text-sm text-neutral-900">
                Checkout Funnel & Reader Engagement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">1. Discovery</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">{data.metrics.totalPageViews}</span>
                  <span className="text-[11px] text-neutral-400 block">Total visits</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">2. Catalogue / Book</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">{data.metrics.bookViews}</span>
                  <span className="text-[11px] text-neutral-400 block">Book detail views</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
                  <span className="text-[10px] uppercase font-mono text-neutral-500 block">3. Checkout</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">{data.metrics.checkoutsInitiated}</span>
                  <span className="text-[11px] text-neutral-400 block">Initiated Razorpay</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-mono text-emerald-700 block font-semibold">4. Paid / Entitled</span>
                  <span className="text-lg font-bold font-mono text-emerald-800">{data.metrics.completedPurchases}</span>
                  <span className="text-[11px] text-emerald-600 block">Completed orders</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Books & Search Queries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-serif font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-neutral-600" />
                  Most Viewed Titles
                </h3>
                {data.topBooks.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4">No book views logged in this date range.</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {data.topBooks.map((b, i) => (
                      <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-neutral-400 w-4">#{i + 1}</span>
                          <span className="font-medium text-neutral-900">{b.title}</span>
                        </div>
                        <span className="font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                          {b.views} views
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-xs">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-serif font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Search className="h-4 w-4 text-neutral-600" />
                  Popular Search Queries
                </h3>
                {data.topSearches.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4">No search queries logged in this date range.</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {data.topSearches.map((s, i) => (
                      <div key={s.query} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-neutral-400 w-4">#{i + 1}</span>
                          <span className="font-medium text-neutral-900 font-mono">“{s.query}”</span>
                        </div>
                        <span className="font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                          {s.count} searches
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
