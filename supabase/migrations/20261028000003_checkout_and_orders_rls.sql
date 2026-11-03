-- ==============================================================================
-- HiddenBooks: Secure Checkout, Orders, Payments & Entitlements RLS Policies
-- Migration: 20261028000003_checkout_and_orders_rls.sql
-- ==============================================================================

-- 1. ORDERS TABLE RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users and admins can view relevant orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can cancel own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- SELECT: Users see own orders, admins see all orders
CREATE POLICY "Users and admins can view relevant orders" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- INSERT: Authenticated users can insert their own pending orders (or 100% free claims)
CREATE POLICY "Users can insert own pending orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      status = 'pending'::order_status_type
      OR (status = 'paid'::order_status_type AND total_cents = 0)
      OR public.is_admin(auth.uid())
    )
  );

-- UPDATE: Admins manage all statuses; users can only cancel their own pending orders
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can cancel own pending orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending'::order_status_type)
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled'::order_status_type);

-- DELETE: Admins only
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));


-- 2. ORDER ITEMS TABLE RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users and admins can view relevant order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;

-- SELECT: Users see order items of their own orders, admins see all
CREATE POLICY "Users and admins can view relevant order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- INSERT: Authenticated users can insert order items for their own orders
CREATE POLICY "Users can insert own order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
          AND o.user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.books b
        WHERE b.id = order_items.book_id
          AND (b.is_published = true OR public.is_admin(auth.uid()))
      )
    )
    OR public.is_admin(auth.uid())
  );

-- UPDATE / DELETE: Admins only
CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- 3. PAYMENTS TABLE RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users and admins can view relevant payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own pending payments" ON public.payments;

-- SELECT: Users see own payments, admins see all
CREATE POLICY "Users and admins can view relevant payments" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- INSERT: Authenticated users can create pending payment records for their own orders
CREATE POLICY "Users can insert own pending payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      auth.uid() = user_id
      AND status = 'pending'::payment_status_type
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payments.order_id AND o.user_id = auth.uid()
      )
    )
    OR public.is_admin(auth.uid())
  );

-- UPDATE / DELETE: Admins only
CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- 4. BOOK ENTITLEMENTS TABLE RLS
ALTER TABLE public.book_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage entitlements" ON public.book_entitlements;
DROP POLICY IF EXISTS "Users can view own entitlements" ON public.book_entitlements;
DROP POLICY IF EXISTS "Users and admins can view relevant entitlements" ON public.book_entitlements;
DROP POLICY IF EXISTS "Users can insert free claim entitlements" ON public.book_entitlements;

-- SELECT: Users see own entitlements, admins see all
CREATE POLICY "Users and admins can view relevant entitlements" ON public.book_entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- INSERT: Users can only claim genuinely free books (or admins manage)
CREATE POLICY "Users can insert free claim entitlements" ON public.book_entitlements
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      auth.uid() = user_id
      AND entitlement_type = 'free_claim'
      AND EXISTS (
        SELECT 1 FROM public.books b
        WHERE b.id = book_entitlements.book_id
          AND (b.is_free = true OR b.price_cents = 0)
          AND (b.is_published = true OR public.is_admin(auth.uid()))
      )
      AND (
        order_id IS NULL OR EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = book_entitlements.order_id
            AND o.user_id = auth.uid()
            AND o.total_cents = 0
            AND o.status = 'paid'::order_status_type
        )
      )
    )
    OR public.is_admin(auth.uid())
  );

-- UPDATE / DELETE: Admins only
CREATE POLICY "Admins can manage entitlements" ON public.book_entitlements
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- 5. ATOMIC AUTHORITATIVE PAYMENT CONFIRMATION PROCEDURE (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id UUID DEFAULT NULL,
  p_razorpay_order_id TEXT DEFAULT NULL,
  p_razorpay_payment_id TEXT DEFAULT NULL,
  p_razorpay_signature TEXT DEFAULT NULL,
  p_raw_response JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_payment RECORD;
  v_item RECORD;
  v_resolved_order_id UUID := p_order_id;
BEGIN
  -- 1. Fetch payment record first if order_id is not provided
  IF p_razorpay_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing razorpay_order_id');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE razorpay_order_id = p_razorpay_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found for Razorpay order');
  END IF;

  IF v_resolved_order_id IS NULL THEN
    v_resolved_order_id := v_payment.order_id;
  ELSIF v_payment.order_id <> v_resolved_order_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID mismatch with payment record');
  END IF;

  -- 2. Fetch order record
  SELECT * INTO v_order FROM public.orders WHERE id = v_resolved_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- 3. Idempotent check: If already processed, return success
  IF v_payment.status = 'captured'::payment_status_type AND v_order.status = 'paid'::order_status_type THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_resolved_order_id,
      'user_id', v_order.user_id,
      'already_captured', true,
      'message', 'Payment was already captured and processed.'
    );
  END IF;

  -- 4. Update payment record
  UPDATE public.payments
  SET
    status = 'captured'::payment_status_type,
    razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
    razorpay_signature = COALESCE(p_razorpay_signature, razorpay_signature),
    raw_response = CASE WHEN p_raw_response IS NOT NULL AND p_raw_response <> '{}'::jsonb THEN p_raw_response ELSE raw_response END,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.id;

  -- 5. Update order record
  UPDATE public.orders
  SET
    status = 'paid'::order_status_type,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_resolved_order_id;

  -- 6. Grant entitlements for all books in order_items
  FOR v_item IN SELECT book_id FROM public.order_items WHERE order_id = p_order_id
  LOOP
    INSERT INTO public.book_entitlements (
      user_id,
      book_id,
      order_id,
      entitlement_type,
      is_revoked,
      granted_at
    ) VALUES (
      v_order.user_id,
      v_item.book_id,
      p_order_id,
      'purchase',
      false,
      timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
      is_revoked = false,
      order_id = p_order_id,
      granted_at = timezone('utc'::text, now());

    -- Increment sales count
    UPDATE public.books
    SET sales_count = COALESCE(sales_count, 0) + 1
    WHERE id = v_item.book_id;
  END LOOP;

  -- 7. Record coupon redemption if applicable
  IF v_order.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (
      coupon_id,
      user_id,
      order_id,
      discount_applied_cents,
      redeemed_at
    ) VALUES (
      v_order.coupon_id,
      v_order.user_id,
      p_order_id,
      COALESCE(v_order.discount_cents, 0),
      timezone('utc'::text, now())
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.coupons
    SET current_redemptions = COALESCE(current_redemptions, 0) + 1
    WHERE id = v_order.coupon_id;
  END IF;

  -- 8. Record verified analytics event
  INSERT INTO public.analytics_events (
    event_name,
    user_id,
    metadata
  ) VALUES (
    'PURCHASE_VERIFIED',
    v_order.user_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'amount_cents', v_order.total_cents,
      'razorpay_payment_id', p_razorpay_payment_id,
      'razorpay_order_id', p_razorpay_order_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'user_id', v_order.user_id,
    'already_captured', false,
    'message', 'Payment verified and library entitlement granted successfully.'
  );
END;
$$;

-- 6. WEBHOOK FAILURE & REFUND HANDLERS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mark_order_payment_failed(
  p_razorpay_order_id TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_desc TEXT DEFAULT NULL,
  p_raw_response JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE razorpay_order_id = p_razorpay_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  UPDATE public.payments
  SET
    status = 'failed'::payment_status_type,
    error_code = p_error_code,
    error_description = p_error_desc,
    raw_response = COALESCE(p_raw_response, raw_response),
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.id;

  UPDATE public.orders
  SET
    status = 'failed'::order_status_type,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_payment.order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_order_refund(
  p_razorpay_payment_id TEXT,
  p_amount_cents INT,
  p_currency TEXT,
  p_refund_id TEXT,
  p_reason TEXT DEFAULT 'Customer requested refund',
  p_raw_response JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE razorpay_payment_id = p_razorpay_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  UPDATE public.payments
  SET
    status = 'refunded'::payment_status_type,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.id;

  UPDATE public.orders
  SET
    status = 'refunded'::order_status_type,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.order_id;

  INSERT INTO public.refunds (
    payment_id,
    order_id,
    amount_cents,
    currency,
    razorpay_refund_id,
    reason,
    status
  ) VALUES (
    v_payment.id,
    v_payment.order_id,
    p_amount_cents,
    p_currency,
    p_refund_id,
    p_reason,
    'processed'
  );

  -- Revoke entitlements
  FOR v_item IN SELECT book_id FROM public.order_items WHERE order_id = v_payment.order_id
  LOOP
    UPDATE public.book_entitlements
    SET is_revoked = true
    WHERE user_id = v_payment.user_id AND book_id = v_item.book_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'order_id', v_payment.order_id);
END;
$$;

-- Grant EXECUTE permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.confirm_order_payment TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.process_order_refund TO authenticated, service_role, anon;
