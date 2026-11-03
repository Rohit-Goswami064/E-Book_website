-- Migration: Guest Checkout and Auto Account Creation
-- Safe idempotency: CREATE OR REPLACE FUNCTION

CREATE OR REPLACE FUNCTION public.get_or_create_guest_user(
  p_email text,
  p_phone text,
  p_full_name text,
  p_raw_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_email text := LOWER(TRIM(p_email));
  v_clean_phone text := REGEXP_REPLACE(TRIM(p_phone), '[^0-9]', '', 'g');
  v_user RECORD;
  v_new_id uuid;
  v_encrypted_password text;
BEGIN
  -- Normalize 10-digit Indian mobile number if provided with country code (91)
  IF LENGTH(v_clean_phone) = 12 AND LEFT(v_clean_phone, 2) = '91' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 3);
  END IF;

  -- 1. Check if user already exists in auth.users by email or phone
  SELECT id, email, phone INTO v_user
  FROM auth.users
  WHERE (v_clean_email <> '' AND LOWER(email) = v_clean_email)
     OR (v_clean_phone <> '' AND phone IS NOT NULL AND (
          phone = v_clean_phone 
          OR phone = '+91' || v_clean_phone 
          OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = v_clean_phone
        ))
  LIMIT 1;

  -- 2. If not found in auth.users, check public.profiles by phone
  IF v_user.id IS NULL AND v_clean_phone <> '' THEN
    SELECT u.id, u.email, u.phone INTO v_user
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.phone = v_clean_phone 
       OR p.phone = '+91' || v_clean_phone
       OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    LIMIT 1;
  END IF;

  -- 3. If user already exists, associate without altering existing password or details
  IF v_user.id IS NOT NULL THEN
    IF v_clean_phone <> '' THEN
      UPDATE public.profiles
      SET phone = COALESCE(phone, v_clean_phone)
      WHERE id = v_user.id;
    END IF;

    RETURN jsonb_build_object(
      'user_id', v_user.id,
      'is_new_account', false,
      'email', v_user.email,
      'phone', v_clean_phone
    );
  END IF;

  -- 4. Create new user account automatically in auth.users
  v_new_id := gen_random_uuid();
  v_encrypted_password := extensions.crypt(p_raw_password, extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    phone,
    encrypted_password,
    email_confirmed_at,
    phone_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_clean_phone,
    v_encrypted_password,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_id::text,
      'full_name', p_full_name,
      'phone', v_clean_phone,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false,
      'created_via', 'guest_checkout'
    ),
    now(),
    now()
  );

  -- 5. Insert into auth.identities so Supabase GoTrue authentication works seamlessly
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_id,
    jsonb_build_object(
      'sub', v_new_id::text,
      'email', v_clean_email,
      'full_name', p_full_name,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_new_id::text,
    now(),
    now(),
    now()
  );

  -- 6. Upsert into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    v_clean_email,
    p_full_name,
    v_clean_phone,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  RETURN jsonb_build_object(
    'user_id', v_new_id,
    'is_new_account', true,
    'email', v_clean_email,
    'phone', v_clean_phone
  );
END;
$$;

-- Secure Order Creation for Checkout (Guest & Authenticated)
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_user_id uuid,
  p_book_id uuid,
  p_order_number text,
  p_subtotal_cents integer,
  p_discount_cents integer,
  p_total_cents integer,
  p_currency text,
  p_coupon_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_order_id uuid;
  v_book RECORD;
BEGIN
  SELECT id, title, price_cents INTO v_book FROM public.books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Book not found');
  END IF;

  INSERT INTO public.orders (
    order_number,
    user_id,
    status,
    subtotal_cents,
    discount_cents,
    total_cents,
    currency,
    coupon_id,
    customer_email,
    customer_name,
    customer_phone,
    metadata
  ) VALUES (
    p_order_number,
    p_user_id,
    'pending',
    p_subtotal_cents,
    p_discount_cents,
    p_total_cents,
    COALESCE(p_currency, 'INR'),
    p_coupon_id,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    p_metadata
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id,
    book_id,
    book_title,
    price_cents
  ) VALUES (
    v_order_id,
    p_book_id,
    v_book.title,
    p_total_cents
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number
  );
END;
$$;

-- Record Pending Razorpay Payment
CREATE OR REPLACE FUNCTION public.record_pending_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_razorpay_order_id text,
  p_amount_cents integer,
  p_currency text,
  p_raw_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payments (
    order_id,
    user_id,
    provider,
    razorpay_order_id,
    status,
    amount_cents,
    currency,
    raw_response
  ) VALUES (
    p_order_id,
    p_user_id,
    'razorpay',
    p_razorpay_order_id,
    'pending',
    p_amount_cents,
    COALESCE(p_currency, 'INR'),
    p_raw_response
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_checkout_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pending_payment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_user TO anon, authenticated;
