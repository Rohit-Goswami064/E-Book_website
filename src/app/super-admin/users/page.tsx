"use client"

import * as React from "react"
import { Search, Shield, User, ShieldAlert, UserCheck, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  role: "customer" | "admin" | "super_admin"
  total_orders: number
  paid_orders: number
  total_spent_cents: number
  purchased_books_count: number
  last_purchase_date: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState("all")
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null)
  const [newRole, setNewRole] = React.useState<"customer" | "admin" | "super_admin">("customer")
  const [updating, setUpdating] = React.useState(false)

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const params = new URLSearchParams()
      if (roleFilter !== "all") params.set("role", roleFilter)
      if (search.trim()) params.set("search", search.trim())

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users || [])
      } else {
        const msg = data.error || "Failed to load registered readers from database"
        setErrorMessage(msg)
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Network error loading users"
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleChange = async () => {
    if (!selectedUser) return
    try {
      setUpdating(true)
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`User role updated to ${newRole}`)
        setSelectedUser(null)
        fetchUsers()
      } else {
        toast.error(data.error || "Failed to update role")
      }
    } catch {
      toast.error("Failed to update role")
    } finally {
      setUpdating(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-mono text-[10px] uppercase gap-1"><ShieldAlert className="h-3 w-3" /> Super Admin</Badge>
      case "admin":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono text-[10px] uppercase gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
      default:
        return <Badge variant="outline" className="bg-neutral-100 text-neutral-600 font-mono text-[10px] uppercase gap-1"><User className="h-3 w-3" /> Customer</Badge>
    }
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Header - Compact for 80/20 ratio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-serif">User Accounts & Roles</h1>
          <p className="text-xs text-neutral-500">Registered readers, order totals, verified spending, and role authorization.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchUsers()} disabled={loading} className="h-8 text-xs">
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
            placeholder="Search email, full name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-neutral-50/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "customer", "admin", "super_admin"].map((rf) => (
            <button
              key={rf}
              onClick={() => setRoleFilter(rf)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                roleFilter === rf
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {rf.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Database Error Banner if query failed */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span><strong>Database Error:</strong> {errorMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchUsers()} className="h-7 text-xs bg-white border-red-300 text-red-700">
            Retry Connection
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50/80 sticky top-0 z-10 border-b border-neutral-200 text-neutral-600 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Reader Name & Mobile</th>
                <th className="py-2.5 px-4 font-semibold">Email</th>
                <th className="py-2.5 px-4 font-semibold">Role</th>
                <th className="py-2.5 px-4 font-semibold">Total Orders</th>
                <th className="py-2.5 px-4 font-semibold">Paid Orders</th>
                <th className="py-2.5 px-4 font-semibold">Total Spent</th>
                <th className="py-2.5 px-4 font-semibold">eBooks Owned</th>
                <th className="py-2.5 px-4 font-semibold">Joined / Last Active</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    Loading registered user profiles...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    <p className="font-medium text-sm text-neutral-700">No users found</p>
                    <p className="text-xs text-neutral-400 mt-1">Registered users will show here automatically.</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {u.full_name ? u.full_name.charAt(0) : u.email.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900 block">{u.full_name || "Reader"}</span>
                          {u.phone ? (
                            <span className="text-[10px] text-neutral-500 font-mono">📱 {u.phone}</span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">No mobile</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-700">{u.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3 px-4 font-mono text-neutral-700">
                      {u.total_orders} {u.total_orders === 1 ? "order" : "orders"}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className={u.paid_orders > 0 ? "text-emerald-700 font-bold" : "text-neutral-400"}>
                        {u.paid_orders} paid
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                      {formatCurrency(u.total_spent_cents)}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-700">
                      <span className={u.purchased_books_count > 0 ? "text-blue-700 font-medium" : "text-neutral-400"}>
                        {u.purchased_books_count} {u.purchased_books_count === 1 ? "book" : "books"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                      <div>{formatDate(u.created_at)}</div>
                      {u.last_purchase_date && (
                        <div className="text-[10px] text-neutral-400">
                          Last bought: {formatDate(u.last_purchase_date)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-neutral-700 hover:text-neutral-900"
                        onClick={() => {
                          setSelectedUser(u)
                          setNewRole(u.role)
                        }}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        Role
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t border-neutral-100 bg-neutral-50/50 text-right text-[11px] text-neutral-500 font-mono px-4">
          Total: {users.length} users
        </div>
      </div>

      {/* Edit Role Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                Change Role for {selectedUser.full_name || selectedUser.email}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <p className="text-neutral-500">
                Granting Admin or Super Admin allows access to protected management areas and financial records.
              </p>
              <div className="space-y-2">
                <label className="text-neutral-700 font-medium block">Select New Role</label>
                {(["customer", "admin", "super_admin"] as const).map((r) => (
                  <label
                    key={r}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      newRole === r ? "border-neutral-900 bg-neutral-50 font-medium" : "border-neutral-200 hover:bg-neutral-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={newRole === r}
                        onChange={() => setNewRole(r)}
                        className="text-neutral-900"
                      />
                      <span className="capitalize">{r.replace("_", " ")}</span>
                    </div>
                    {getRoleBadge(r)}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRoleChange} disabled={updating}>
                {updating ? "Saving..." : "Update Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
