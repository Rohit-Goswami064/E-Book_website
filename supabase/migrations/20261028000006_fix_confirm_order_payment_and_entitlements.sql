-- ==============================================================================
-- Fix confirm_order_payment procedure to use v_resolved_order_id
-- Migration: 20261028000006_fix_confirm_order_payment_and_entitlements.sql
-- ==============================================================================

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
  v_entitlements_granted INT := 0;
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
    -- Ensure entitlements exist even if already marked captured
    FOR v_item IN SELECT book_id FROM public.order_items WHERE order_id = v_resolved_order_id
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
        v_resolved_order_id,
        'purchase',
        false,
        timezone('utc'::text, now())
      )
      ON CONFLICT (user_id, book_id)
      DO UPDATE SET
        is_revoked = false,
        order_id = v_resolved_order_id;
    END LOOP;

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

  -- 6. Grant authoritative entitlements for all books in order_items using v_resolved_order_id
  FOR v_item IN SELECT book_id FROM public.order_items WHERE order_id = v_resolved_order_id
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
      v_resolved_order_id,
      'purchase',
      false,
      timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
      is_revoked = false,
      order_id = v_resolved_order_id,
      granted_at = timezone('utc'::text, now());

    v_entitlements_granted := v_entitlements_granted + 1;

    -- Increment sales count
    UPDATE public.books
    SET sales_count = COALESCE(sales_count, 0) + 1
    WHERE id = v_item.book_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_resolved_order_id,
    'user_id', v_order.user_id,
    'entitlements_granted', v_entitlements_granted
  );
END;
$$;
