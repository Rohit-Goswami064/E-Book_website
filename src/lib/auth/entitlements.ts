import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole } from "@/lib/auth/roles"

export interface AccessVerificationResult {
  authorized: boolean
  reason?: string
  isAdmin?: boolean
  isFree?: boolean
  book?: {
    id: string
    title: string
    is_free: boolean
    is_published: boolean
  }
}

/**
 * Server-side authoritative verification for accessing protected publications.
 * Security & Logic Guarantees:
 * 1. Strict Fail-Closed Architecture: Fails closed (authorized: false) by default on any error or missing assertion.
 * 2. Strict Draft Protection: Unpublished publications (is_published !== true) strictly block access
 *    for all regular customers and anonymous visitors. Only verified admin or super_admin accounts may access.
 * 3. Freshness & Cache-Bypassing: Database queries use an authoritative client with cache: 'no-store'
 *    to bypass Next.js data cache and ensure newly purchased entitlements are immediately recognized.
 * 4. Multi-Layer Entitlement Verification: Checks active book_entitlements and verified paid orders + captured payments.
 */
export async function verifyPublicationAccess(
  userId: string | null,
  publicationId: string
): Promise<AccessVerificationResult> {
  // Fail-closed guard against invalid publication identifiers
  if (!publicationId || typeof publicationId !== "string" || publicationId.trim() === "") {
    return { authorized: false, reason: "Invalid publication identifier provided." }
  }

  try {
    // Authoritative client with Next.js cache bypassing (cache: 'no-store')
    const supabase = createAdminClient()

    // 1. Fetch authoritative publication record from database
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, is_free, is_published, price_cents")
      .eq("id", publicationId)
      .maybeSingle()

    if (bookError || !book) {
      return { authorized: false, reason: "Publication does not exist or could not be loaded." }
    }

    // 2. Authoritative Administrator Role Check
    let isAdmin = false
    if (userId) {
      const role = await getUserRole(userId)
      isAdmin = role === "admin" || role === "super_admin"
    }

    // 3. Strict Draft Protection:
    // If publication is not published, strictly block all non-administrators immediately
    if (book.is_published !== true) {
      if (!isAdmin) {
        return {
          authorized: false,
          reason: "This publication is not currently published.",
        }
      }
    }

    // 4. Administrator bypass (super_admin / admin can read all drafts and publications)
    if (isAdmin) {
      return {
        authorized: true,
        isAdmin: true,
        isFree: Boolean(book.is_free),
        book,
      }
    }

    // 5. Free publication check (published free books are accessible to visitors and readers)
    if (book.is_free === true) {
      return {
        authorized: true,
        isFree: true,
        book,
      }
    }

    // 6. Paid publication authentication enforcement
    if (!userId) {
      return {
        authorized: false,
        reason: "Authentication required to access paid publication content.",
      }
    }

    // 7. Authoritative entitlement check in book_entitlements table
    const { data: entitlement, error: entitlementError } = await supabase
      .from("book_entitlements")
      .select("id, is_revoked, expires_at")
      .eq("user_id", userId)
      .eq("book_id", publicationId)
      .eq("is_revoked", false)
      .maybeSingle()

    if (entitlementError) {
      console.error("[Entitlement Check DB Error]:", entitlementError.message)
      return { authorized: false, reason: "Failed to verify entitlement license records." }
    }

    if (entitlement) {
      // Check expiration timestamp if configured
      if (entitlement.expires_at && new Date(entitlement.expires_at) < new Date()) {
        return { authorized: false, reason: "Access entitlement has expired." }
      }
      return { authorized: true, book }
    }

    // 8. Direct server-side payment verification fallback:
    // Verify an order for this book is marked 'paid' AND payment is 'captured'
    const { data: orderItem, error: orderError } = await supabase
      .from("order_items")
      .select("order_id, orders!inner(id, user_id, status)")
      .eq("book_id", publicationId)
      .eq("orders.user_id", userId)
      .eq("orders.status", "paid")
      .limit(1)
      .maybeSingle()

    if (orderError) {
      console.error("[Order Verification DB Error]:", orderError.message)
      return { authorized: false, reason: "Failed to verify purchase order records." }
    }

    if (orderItem) {
      const orderId = (orderItem.orders as any)?.id
      if (orderId) {
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("status", "captured")
          .limit(1)
          .maybeSingle()

        if (!paymentError && payment) {
          return { authorized: true, book }
        }
      }
    }

    // 9. Default Fail-Closed Fallback
    return {
      authorized: false,
      reason: "Access denied. Valid purchase entitlement or claim record was not found.",
    }
  } catch (error: any) {
    console.error("[verifyPublicationAccess Unexpected Error]:", error?.message || error)
    // Fail closed on any exception
    return {
      authorized: false,
      reason: "An unexpected error occurred during access verification.",
    }
  }
}
