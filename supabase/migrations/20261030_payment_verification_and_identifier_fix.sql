-- Migration: Fix Payment Verification and Secure Identifier Resolution
-- Migration Date: 2026-10-30

-- 1. Enhanced confirm_order_payment function
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_order RECORD;
  v_payment RECORD;
  v_item RECORD;
  v_resolved_order_id UUID := p_order_id;
  v_entitlements_granted INT := 0;
  v_first_book_id UUID;
  v_guest_password TEXT;
  v_is_new_account BOOLEAN := false;
  v_other_payment_id UUID;
  v_verified_amount BIGINT;
  v_raw_amount_text TEXT;
BEGIN
  -- 1. Input Validation
  IF p_razorpay_order_id IS NULL OR TRIM(p_razorpay_order_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing razorpay_order_id');
  END IF;

  -- 2. Fetch and lock payment record in payments table
  SELECT * INTO v_payment 
  FROM public.payments 
  WHERE razorpay_order_id = p_razorpay_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found for Razorpay order');
  END IF;

  -- Resolve and verify order ID consistency
  IF v_resolved_order_id IS NULL THEN
    v_resolved_order_id := v_payment.order_id;
  ELSIF v_payment.order_id <> v_resolved_order_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID mismatch with payment record');
  END IF;

  -- 3. Fetch and lock order record in orders table
  SELECT * INTO v_order 
  FROM public.orders 
  WHERE id = v_resolved_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify user identity consistency
  IF v_payment.user_id <> v_order.user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID mismatch between payment and order records');
  END IF;

  -- Extract order metadata
  v_is_new_account := COALESCE((v_order.metadata->>'is_new_account')::boolean, false);
  v_guest_password := v_order.metadata->>'guest_password';

  -- Resolve primary book_id for client navigation response
  SELECT book_id INTO v_first_book_id 
  FROM public.order_items 
  WHERE order_id = v_resolved_order_id 
  LIMIT 1;

  IF v_first_book_id IS NULL AND (v_order.metadata ? 'book_id') THEN
    v_first_book_id := (v_order.metadata->>'book_id')::uuid;
  END IF;

  -- 4. Replay Attack Detection: Verify razorpay_payment_id is not already captured on a different payment
  IF p_razorpay_payment_id IS NOT NULL AND TRIM(p_razorpay_payment_id) <> '' THEN
    SELECT id INTO v_other_payment_id
    FROM public.payments
    WHERE razorpay_payment_id = p_razorpay_payment_id
      AND id <> v_payment.id
      AND status = 'captured'::payment_status_type
    LIMIT 1;

    IF v_other_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Payment replay detected: razorpay_payment_id has already been processed for another transaction'
      );
    END IF;
  END IF;

  -- 5. Idempotent Return: If already captured or order is already marked paid, return success without duplicate actions
  IF v_payment.status = 'captured'::payment_status_type OR v_order.status = 'paid'::order_status_type THEN
    -- Ensure entitlements exist idempotently
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
      'customer_email', v_order.customer_email,
      'customer_name', v_order.customer_name,
      'customer_phone', v_order.customer_phone,
      'book_id', v_first_book_id,
      'amount_cents', v_payment.amount_cents,
      'currency', v_payment.currency,
      'is_new_account', v_is_new_account,
      'guest_password', v_guest_password,
      'already_captured', true,
      'message', 'Payment was already captured and processed.'
    );
  END IF;

  -- 6. Strict Validation: Paid Amount Must Match or Exceed Order Total
  v_verified_amount := v_payment.amount_cents;
  
  -- Extract gateway amount from raw payload if present
  IF p_raw_response ? 'amount' THEN
    v_raw_amount_text := p_raw_response->>'amount';
    IF v_raw_amount_text ~ '^[0-9]+$' THEN
      v_verified_amount := v_raw_amount_text::bigint;
    END IF;
  ELSIF (p_raw_response ? 'payment') AND (p_raw_response->'payment' ? 'entity') AND (p_raw_response->'payment'->'entity' ? 'amount') THEN
    v_raw_amount_text := p_raw_response->'payment'->'entity'->>'amount';
    IF v_raw_amount_text ~ '^[0-9]+$' THEN
      v_verified_amount := v_raw_amount_text::bigint;
    END IF;
  END IF;

  IF v_verified_amount < v_order.total_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment validation failed: paid amount (' || v_verified_amount || ' cents) is less than required order total (' || v_order.total_cents || ' cents)'
    );
  END IF;

  -- 7. Atomic Transition: Update payment record
  UPDATE public.payments
  SET
    status = 'captured'::payment_status_type,
    amount_cents = v_verified_amount,
    razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
    razorpay_signature = COALESCE(p_razorpay_signature, razorpay_signature),
    raw_response = CASE 
      WHEN p_raw_response IS NOT NULL AND p_raw_response <> '{}'::jsonb 
      THEN p_raw_response 
      ELSE raw_response 
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_payment.id;

  -- 8. Atomic Transition: Update order record (sanitize sensitive guest password from metadata)
  UPDATE public.orders
  SET
    status = 'paid'::order_status_type,
    metadata = CASE 
      WHEN metadata ? 'guest_password' 
      THEN metadata - 'guest_password' 
      ELSE metadata 
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_resolved_order_id;

  -- 9. Atomic Transition: Grant authoritative entitlements and increment sales counts
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
    'customer_email', v_order.customer_email,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'book_id', v_first_book_id,
    'amount_cents', v_verified_amount,
    'currency', v_payment.currency,
    'is_new_account', v_is_new_account,
    'guest_password', v_guest_password,
    'entitlements_granted', v_entitlements_granted,
    'already_captured', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_payment TO authenticated, service_role, anon;

-- 2. Secure identifier resolution function
CREATE OR REPLACE FUNCTION public.resolve_user_identifier(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean text := TRIM(p_identifier);
  v_clean_phone text := REGEXP_REPLACE(v_clean, '[^0-9]', '', 'g');
  v_user RECORD;
BEGIN
  -- 1. If it contains '@', it's an email
  IF POSITION('@' IN v_clean) > 0 THEN
    SELECT id, email INTO v_user
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_clean)
    LIMIT 1;

    IF v_user.id IS NOT NULL THEN
      RETURN jsonb_build_object('found', true, 'email', v_user.email, 'is_phone', false);
    ELSE
      RETURN jsonb_build_object('found', false);
    END IF;
  END IF;

  -- 2. It's a mobile number: normalize Indian country codes
  IF LENGTH(v_clean_phone) = 12 AND LEFT(v_clean_phone, 2) = '91' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 3);
  ELSIF LENGTH(v_clean_phone) = 11 AND LEFT(v_clean_phone, 1) = '0' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 2);
  ELSIF LENGTH(v_clean_phone) > 10 THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM LENGTH(v_clean_phone) - 9);
  END IF;

  IF LENGTH(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid mobile number format');
  END IF;

  -- 3. Check public.profiles first
  SELECT email, phone INTO v_user
  FROM public.profiles
  WHERE phone = v_clean_phone
     OR phone = '+91' || v_clean_phone
     OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
  LIMIT 1;

  IF v_user.email IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'email', v_user.email,
      'phone', v_clean_phone,
      'is_phone', true
    );
  END IF;

  -- 4. Check auth.users fallback
  SELECT email, phone INTO v_user
  FROM auth.users
  WHERE phone = v_clean_phone
     OR phone = '+91' || v_clean_phone
     OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
  LIMIT 1;

  IF v_user.email IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'email', v_user.email,
      'phone', v_clean_phone,
      'is_phone', true
    );
  END IF;

  RETURN jsonb_build_object('found', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_user_identifier(text) TO anon, authenticated, service_role;
