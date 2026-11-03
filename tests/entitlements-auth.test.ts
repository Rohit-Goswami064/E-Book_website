import { describe, it } from "node:test"
import assert from "node:assert/strict"

interface MockEntitlement {
  id: string
  user_id: string
  book_id: string
  order_id: string | null
  entitlement_type: "purchase" | "free_claim" | "admin_grant"
  is_revoked: boolean
}

interface MockUser {
  id: string
  email: string
  role: "customer" | "admin" | "super_admin"
}

// Verification function mimicking checkBookEntitlement
function canUserReadBook(
  userId: string | null,
  bookId: string,
  isBookFree: boolean,
  entitlements: MockEntitlement[]
): { allowed: boolean; reason?: string } {
  if (!userId) {
    return { allowed: false, reason: "Authentication required" }
  }

  // Free books allow immediate reading or claim
  if (isBookFree) {
    return { allowed: true }
  }

  // Check paid entitlement
  const activeEntitlement = entitlements.find(
    (e) => e.user_id === userId && e.book_id === bookId && !e.is_revoked
  )

  if (!activeEntitlement) {
    return { allowed: false, reason: "Book not purchased or entitlement revoked" }
  }

  return { allowed: true }
}

function canUserAccessAdminRoute(user: MockUser | null): boolean {
  if (!user) return false
  return user.role === "admin" || user.role === "super_admin"
}

describe("Entitlements, Access Control & Security Boundaries", () => {
  const userA: MockUser = { id: "user_aaa", email: "reader_a@example.com", role: "customer" }
  const userB: MockUser = { id: "user_bbb", email: "reader_b@example.com", role: "customer" }
  const adminUser: MockUser = { id: "admin_1", email: "admin@hiddenbooks.com", role: "super_admin" }

  const entitlements: MockEntitlement[] = [
    {
      id: "ent_1",
      user_id: userA.id,
      book_id: "book_stoic_001",
      order_id: "ord_1001",
      entitlement_type: "purchase",
      is_revoked: false,
    },
    {
      id: "ent_2",
      user_id: userA.id,
      book_id: "book_refunded_002",
      order_id: "ord_1002",
      entitlement_type: "purchase",
      is_revoked: true, // Revoked upon refund!
    },
  ]

  it("denies access to protected eBook when visitor is not authenticated", () => {
    const res = canUserReadBook(null, "book_stoic_001", false, entitlements)
    assert.equal(res.allowed, false)
    assert.equal(res.reason, "Authentication required")
  })

  it("permits access when user has valid, active entitlement for the book", () => {
    const res = canUserReadBook(userA.id, "book_stoic_001", false, entitlements)
    assert.equal(res.allowed, true)
  })

  it("denies access to paid book when user has not purchased it", () => {
    const res = canUserReadBook(userB.id, "book_stoic_001", false, entitlements)
    assert.equal(res.allowed, false)
    assert.equal(res.reason, "Book not purchased or entitlement revoked")
  })

  it("denies access immediately when entitlement was revoked after refund", () => {
    const res = canUserReadBook(userA.id, "book_refunded_002", false, entitlements)
    assert.equal(res.allowed, false)
    assert.equal(res.reason, "Book not purchased or entitlement revoked")
  })

  it("allows authenticated reader to access genuine free books", () => {
    const res = canUserReadBook(userB.id, "book_free_sample", true, entitlements)
    assert.equal(res.allowed, true)
  })

  it("blocks regular customer from accessing super admin dashboard or management APIs", () => {
    assert.equal(canUserAccessAdminRoute(userA), false)
    assert.equal(canUserAccessAdminRoute(null), false)
  })

  it("allows verified super admin to access administrative routes", () => {
    assert.equal(canUserAccessAdminRoute(adminUser), true)
  })
})
