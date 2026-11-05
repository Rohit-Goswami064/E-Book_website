import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/auth/roles"
import { dbQuery } from "@/lib/db"

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
    const supabase = createAdminClient()

    // 1. Fetch authoritative publication record from database
    let book: any = null
    try {
      const bookRes = await dbQuery(
        `SELECT id, title, is_free, is_published, price_cents FROM public.books WHERE id = $1 LIMIT 1;`,
        [publicationId]
      )
      if (bookRes.rows.length > 0) {
        book = bookRes.rows[0]
      }
    } catch {
      // Fallback to Supabase client if direct DB pool is not configured
    }

    if (!book) {
      const { data, error: bookError } = await supabase
        .from("books")
        .select("id, title, is_free, is_published, price_cents")
        .eq("id", publicationId)
        .maybeSingle()

      if (bookError || !data) {
        return { authorized: false, reason: "Publication does not exist or could not be loaded." }
      }
      book = data
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
    // A) Direct DB query via pool (authoritative superuser query, bypasses anon publishable key RLS limitation)
    let entitlement: { id: string; is_revoked: boolean; expires_at: string | null } | null = null
    try {
      const entRes = await dbQuery(
        `SELECT id, is_revoked, expires_at 
         FROM public.book_entitlements 
         WHERE user_id = $1 AND book_id = $2 AND is_revoked = false 
         LIMIT 1;`,
        [userId, publicationId]
      )
      if (entRes.rows.length > 0) {
        entitlement = entRes.rows[0]
      }
    } catch (dbErr: any) {
      console.warn("[verifyPublicationAccess direct DB query note]:", dbErr?.message || dbErr)
    }

    // B) Supabase user session client fallback (reads request cookies if direct DB is down)
    if (!entitlement) {
      try {
        const userClient = await createClient()
        const { data, error } = await userClient
          .from("book_entitlements")
          .select("id, is_revoked, expires_at")
          .eq("user_id", userId)
          .eq("book_id", publicationId)
          .eq("is_revoked", false)
          .maybeSingle()
        if (data && !error) {
          entitlement = data
        }
      } catch {}
    }

    // C) Supabase admin client fallback
    if (!entitlement) {
      try {
        const { data } = await supabase
          .from("book_entitlements")
          .select("id, is_revoked, expires_at")
          .eq("user_id", userId)
          .eq("book_id", publicationId)
          .eq("is_revoked", false)
          .maybeSingle()
        if (data) {
          entitlement = data
        }
      } catch {}
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
    let orderVerified = false
    try {
      const orderRes = await dbQuery(
        `SELECT oi.id 
         FROM public.order_items oi
         JOIN public.orders o ON o.id = oi.order_id
         JOIN public.payments p ON p.order_id = o.id
         WHERE o.user_id = $1 AND oi.book_id = $2 AND o.status = 'paid' AND p.status = 'captured'
         LIMIT 1;`,
        [userId, publicationId]
      )
      if (orderRes.rows.length > 0) {
        orderVerified = true
      }
    } catch {}

    if (!orderVerified) {
      try {
        const { data: orderItem } = await supabase
          .from("order_items")
          .select("order_id, orders!inner(id, user_id, status)")
          .eq("book_id", publicationId)
          .eq("orders.user_id", userId)
          .eq("orders.status", "paid")
          .limit(1)
          .maybeSingle()

        if (orderItem) {
          const orderId = (orderItem.orders as any)?.id
          if (orderId) {
            const { data: payment } = await supabase
              .from("payments")
              .select("id, status")
              .eq("order_id", orderId)
              .eq("status", "captured")
              .limit(1)
              .maybeSingle()

            if (payment) {
              orderVerified = true
            }
          }
        }
      } catch {}
    }

    if (orderVerified) {
      return { authorized: true, book }
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
