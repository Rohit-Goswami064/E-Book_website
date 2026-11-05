"use client"

import * as React from "react"
import { Search, RotateCcw, Eye, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Order {
  id: string
  order_number: string
  user_id: string
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled"
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  currency: string
  customer_email: string
  customer_name: string | null
  customer_phone: string | null
  metadata?: {
    is_new_account?: boolean
    book_id?: string
    customer_phone?: string
  } | null
  entitlement_status?: "granted" | "pending" | "revoked" | null
  created_at: string
  order_items?: {
    id: string
    book_id: string
    book_title: string
    price_cents: number
  }[]
  payments?: {
    id: string
    provider: string
    razorpay_order_id: string
    razorpay_payment_id: string | null
    status: string
    amount_cents: number
    created_at: string
  }[]
  refunds?: {
    id: string
    amount_cents: number
    reason: string
    status: string
    razorpay_refund_id: string | null
    created_at: string
  }[]
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [refundOrder, setRefundOrder] = React.useState<Order | null>(null)
  const [refundReason, setRefundReason] = React.useState("")
  const [refunding, setRefunding] = React.useState(false)

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (search.trim()) params.set("search", search.trim())

      const res = await fetch(`/api/admin/orders?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setOrders(data.orders || [])
      } else {
        const msg = data.error || "Failed to load order records from database"
        setErrorMessage(msg)
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Network error loading orders"
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleRefund = async () => {
    if (!refundOrder) return
    try {
      setRefunding(true)
      const res = await fetch(`/api/admin/orders/${refundOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Order refunded and entitlement revoked successfully")
        setRefundOrder(null)
        setRefundReason("")
        fetchOrders()
      } else {
        toast.error(data.error || "Failed to process refund")
      }
    } catch {
      toast.error("Refund request failed")
    } finally {
      setRefunding(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="outline" className="gap-1 font-mono text-[11px] text-emerald-800 bg-emerald-50 border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
      case "pending":
        return <Badge variant="outline" className="gap-1 font-mono text-[11px] text-amber-700 bg-amber-50 border-amber-200"><Clock className="h-3 w-3" /> Pending</Badge>
      case "refunded":
        return <Badge variant="outline" className="gap-1 font-mono text-[11px] text-purple-700 bg-purple-50 border-purple-200"><RotateCcw className="h-3 w-3" /> Refunded</Badge>
      default:
        return <Badge variant="outline" className="gap-1 font-mono text-[11px] text-red-700 bg-red-50 border-red-200"><XCircle className="h-3 w-3" /> {status}</Badge>
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact for 80/20 data ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">Orders & Transactions</h1>
          <p className="text-xs text-neutral-500">Real-time payment records, Razorpay IDs, customer mobile numbers, and entitlement status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchOrders()} disabled={loading} className="h-8 text-xs">
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-2.5 rounded-lg border border-neutral-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <Input
            placeholder="Search order #, customer, email, phone, RZP pay ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-neutral-50/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "paid", "pending", "failed", "refunded"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                statusFilter === st
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Database Error Banner if query failed */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span><strong>Database Query Error:</strong> {errorMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchOrders()} className="h-7 text-xs bg-white border-red-300 text-red-700">
            Retry Connection
          </Button>
        </div>
      )}

      {/* Data Table Container - flex-1 for max screen visibility */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Order ID</th>
                <th className="py-2.5 px-4 font-semibold">Customer Details</th>
                <th className="py-2.5 px-4 font-semibold">Purchased Publication</th>
                <th className="py-2.5 px-4 font-semibold">Amount / Discount</th>
                <th className="py-2.5 px-4 font-semibold">Order Status</th>
                <th className="py-2.5 px-4 font-semibold">Razorpay Reference</th>
                <th className="py-2.5 px-4 font-semibold">Date & Time</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    Loading live order database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No orders found</p>
                    <p className="text-xs text-neutral-400 mt-1">Real purchases made by customers will populate here.</p>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const paymentRef = ord.payments?.[0]?.razorpay_payment_id || ord.payments?.[0]?.razorpay_order_id || "—"
                  const bookTitle = ord.order_items && ord.order_items.length > 0
                    ? ord.order_items.map((i) => i.book_title).join(", ")
                    : "1 item"

                  return (
                    <tr key={ord.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900">{ord.customer_name || "—"}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">{ord.customer_email}</div>
                        {ord.customer_phone && (
                          <div className="text-[10px] text-neutral-400 font-mono">
                            📱 {ord.customer_phone.startsWith("+91") ? ord.customer_phone : `+91 ${ord.customer_phone}`}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                              ord.metadata?.is_new_account
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-700 border-neutral-200"
                            }`}
                          >
                            {ord.metadata?.is_new_account ? "New Account" : "Existing User"}
                          </span>
                          {ord.status === "paid" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                              Entitled
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-neutral-700 font-medium">
                        {bookTitle}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-neutral-900 block">
                          {formatCurrency(ord.total_cents, ord.currency)}
                        </span>
                        {ord.discount_cents > 0 && (
                          <span className="text-[10px] text-emerald-600 font-mono">
                            - {formatCurrency(ord.discount_cents, ord.currency)} discount
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(ord.status)}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">
                        {paymentRef}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                        {formatDate(ord.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedOrder(ord)}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5 text-neutral-600" />
                          </Button>
                          {ord.status === "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px]"
                              onClick={() => {
                                setRefundOrder(ord)
                                setRefundReason("")
                              }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 text-right text-[11px] text-neutral-500 font-mono px-4">
          Total: {orders.length} orders
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                Order #{selectedOrder.order_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Status</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Total Paid</span>
                  <span className="font-mono font-bold text-sm text-neutral-900">
                    {formatCurrency(selectedOrder.total_cents, selectedOrder.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Customer</span>
                  <span className="font-medium text-neutral-900">{selectedOrder.customer_name || "—"}</span>
                  <span className="block text-neutral-500 font-mono text-[11px]">{selectedOrder.customer_email}</span>
                  {selectedOrder.customer_phone && (
                    <span className="block text-neutral-500 font-mono text-[11px]">📱 {selectedOrder.customer_phone}</span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase">Date Placed</span>
                  <span className="font-mono text-neutral-700">{formatDate(selectedOrder.created_at)}</span>
                </div>
              </div>

              {/* Account Linkage & Entitlement Status */}
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Account Linkage:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      selectedOrder.metadata?.is_new_account
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {selectedOrder.metadata?.is_new_account
                      ? "New Account Created"
                      : "Linked to Existing Account"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Entitlement Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      selectedOrder.status === "paid"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {selectedOrder.status === "paid"
                      ? "Active Library Entitlement Granted"
                      : "Pending Authorization"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-900 mb-2">Order Items</h4>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-md">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="p-2.5 flex justify-between items-center">
                      <span className="font-medium text-neutral-900">{item.book_title}</span>
                      <span className="font-mono text-neutral-700">
                        {formatCurrency(item.price_cents, selectedOrder.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-neutral-900 mb-2">Payment Transaction</h4>
                  <div className="space-y-1.5 bg-neutral-50 p-3 rounded-md border border-neutral-200 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Provider:</span>
                      <span className="uppercase font-semibold">{selectedOrder.payments[0].provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Razorpay Order ID:</span>
                      <span>{selectedOrder.payments[0].razorpay_order_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Razorpay Payment ID:</span>
                      <span className="text-emerald-700 font-semibold">{selectedOrder.payments[0].razorpay_payment_id || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Gateway Status:</span>
                      <span className="capitalize">{selectedOrder.payments[0].status}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedOrder.refunds && selectedOrder.refunds.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-md text-purple-900">
                  <h4 className="font-semibold mb-1 flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Refund Record
                  </h4>
                  <div className="text-[11px] space-y-1">
                    <p>Amount: {formatCurrency(selectedOrder.refunds[0].amount_cents, selectedOrder.currency)}</p>
                    <p>Reason: {selectedOrder.refunds[0].reason || "Not specified"}</p>
                    {selectedOrder.refunds[0].razorpay_refund_id && (
                      <p className="font-mono">Rz Refund ID: {selectedOrder.refunds[0].razorpay_refund_id}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Process Refund Dialog */}
      {refundOrder && (
        <Dialog open={!!refundOrder} onOpenChange={() => setRefundOrder(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold text-red-600">
                Confirm Refund
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <p className="text-neutral-600">
                Are you sure you want to refund order <strong>#{refundOrder.order_number}</strong> for{" "}
                <strong>{formatCurrency(refundOrder.total_cents, refundOrder.currency)}</strong>?
              </p>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px]">
                <strong>Warning:</strong> This will revoke the customer&apos;s book entitlement immediately and trigger a Razorpay refund.
              </div>
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Refund Reason</label>
                <Input
                  placeholder="e.g. Customer requested cancellation"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setRefundOrder(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRefund}
                disabled={refunding}
              >
                {refunding ? "Processing..." : "Execute Refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
