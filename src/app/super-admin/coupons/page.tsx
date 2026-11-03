"use client"

import * as React from "react"
import { Plus, Edit2, Trash2, Ticket, CheckCircle2, XCircle, Calendar, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Coupon {
  id: string
  code: string
  discount_type: "percent" | "fixed"
  discount_value: number
  min_order_amount_cents: number
  max_uses: number | null
  expires_at: string | null
  is_active: boolean
  redemptions_count?: number
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = React.useState<Coupon[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingCoupon, setEditingCoupon] = React.useState<Coupon | null>(null)

  // Form states
  const [code, setCode] = React.useState("")
  const [discountType, setDiscountType] = React.useState<"percent" | "fixed">("percent")
  const [discountValue, setDiscountValue] = React.useState("15")
  const [minOrder, setMinOrder] = React.useState("0")
  const [maxUses, setMaxUses] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const fetchCoupons = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/coupons")
      const data = await res.json()
      if (res.ok) {
        setCoupons(data.coupons || [])
      } else {
        toast.error(data.error || "Failed to load coupons")
      }
    } catch {
      toast.error("Network error loading coupons")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const openCreate = () => {
    setEditingCoupon(null)
    setCode("")
    setDiscountType("percent")
    setDiscountValue("15")
    setMinOrder("0")
    setMaxUses("")
    setExpiresAt("")
    setIsActive(true)
    setModalOpen(true)
  }

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c)
    setCode(c.code)
    setDiscountType(c.discount_type)
    setDiscountValue(
      c.discount_type === "fixed" ? (c.discount_value / 100).toString() : c.discount_value.toString()
    )
    setMinOrder((c.min_order_amount_cents / 100).toString())
    setMaxUses(c.max_uses ? c.max_uses.toString() : "")
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 10) : "")
    setIsActive(c.is_active)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      toast.error("Coupon code is required")
      return
    }

    try {
      setSaving(true)
      const val = parseFloat(discountValue)
      const finalDiscountValue = discountType === "fixed" ? Math.round(val * 100) : Math.round(val)
      const finalMinOrder = Math.round((parseFloat(minOrder) || 0) * 100)

      const method = editingCoupon ? "PUT" : "POST"
      const res = await fetch("/api/admin/coupons", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCoupon?.id,
          code: code.trim().toUpperCase(),
          discount_type: discountType,
          discount_value: finalDiscountValue,
          min_order_amount_cents: finalMinOrder,
          max_uses: maxUses ? parseInt(maxUses) : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          is_active: isActive,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(editingCoupon ? "Coupon updated" : "Coupon created")
        setModalOpen(false)
        fetchCoupons()
      } else {
        toast.error(data.error || "Failed to save coupon")
      }
    } catch {
      toast.error("Save request failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon ${c.code}?`)) return

    try {
      const res = await fetch(`/api/admin/coupons?id=${c.id}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        toast.success("Coupon deleted")
        fetchCoupons()
      } else {
        toast.error(data.error || "Delete failed")
      }
    } catch {
      toast.error("Network error deleting coupon")
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact for 80/20 data table ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">Coupons & Discounts</h1>
          <p className="text-xs text-neutral-500">Configure promotional discounts, usage limits, and expiration dates.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Coupon
        </Button>
      </div>

      {/* Coupons Table - flex-1 */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Code</th>
                <th className="py-2.5 px-4 font-semibold">Discount</th>
                <th className="py-2.5 px-4 font-semibold">Min Order</th>
                <th className="py-2.5 px-4 font-semibold">Redemptions</th>
                <th className="py-2.5 px-4 font-semibold">Expires</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    Loading promotional coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No coupons active</p>
                    <p className="text-xs text-neutral-400 mt-1">Create discount codes to offer promotional savings to readers.</p>
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900 tracking-wider">
                      <span className="inline-flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded">
                        <Ticket className="h-3 w-3 text-neutral-500" />
                        {c.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-900">
                      {c.discount_type === "percent"
                        ? `${c.discount_value}% OFF`
                        : `${formatCurrency(c.discount_value, "INR")} OFF`}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 font-mono">
                      {c.min_order_amount_cents > 0
                        ? formatCurrency(c.min_order_amount_cents, "INR")
                        : "No minimum"}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-700">
                      {c.redemptions_count || 0} / {c.max_uses ? c.max_uses : "∞"}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                      {c.expires_at ? formatDate(c.expires_at) : "Never"}
                    </td>
                    <td className="py-3 px-4">
                      {c.is_active ? (
                        <Badge variant="success" className="gap-1 font-mono text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 font-mono text-[10px] text-neutral-500">
                          <XCircle className="h-3 w-3" /> Disabled
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(c)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-neutral-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(c)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 text-right text-[11px] text-neutral-500 font-mono px-4">
          Total: {coupons.length} coupons
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                {editingCoupon ? "Edit Coupon" : "Create Coupon Code"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Coupon Code</label>
                <Input
                  required
                  placeholder="e.g. SUMMER25"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Discount Type</label>
                  <NativeSelect
                    value={discountType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setDiscountType(e.target.value as "percent" | "fixed")
                    }
                    className="h-8 text-xs"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </NativeSelect>
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    {discountType === "percent" ? "Percentage Off (%)" : "Amount Off (₹)"}
                  </label>
                  <Input
                    required
                    type="number"
                    min="1"
                    max={discountType === "percent" ? "100" : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Min Order Amount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 = no minimum"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">Max Redemptions</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Leave blank for unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Expiration Date (Optional)</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-neutral-900"
                />
                <label htmlFor="isActiveCheck" className="text-neutral-700 font-medium cursor-pointer">
                  Coupon is currently active and can be redeemed
                </label>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving..." : editingCoupon ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
