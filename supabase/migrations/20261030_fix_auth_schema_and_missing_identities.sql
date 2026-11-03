-- Migration: Fix Auth Schema & Missing Identities
-- Migration Date: 2026-10-30

-- 1. Repair all existing users in auth.users with NULL tokens
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL;

-- 2. Insert missing identities for any user in auth.users
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'full_name', COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', 'Customer'),
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

-- 3. Self-healing function for any user
CREATE OR REPLACE FUNCTION public.repair_user_auth(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, '')
  WHERE id = p_user_id;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'full_name', COALESCE(p.full_name, 'Customer'),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    u.id::text,
    now(),
    now(),
    now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = u.id
    );
END;
$$;

-- 4. Update get_or_create_guest_user to self-heal existing users and create flawless new accounts
DROP FUNCTION IF EXISTS public.get_or_create_guest_user(text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_or_create_guest_user(
  p_email text,
  p_phone text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_email text := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_phone text := REGEXP_REPLACE(TRIM(COALESCE(p_phone, '')), '[^0-9]', '', 'g');
  v_user RECORD;
  v_new_id uuid;
BEGIN
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valid email address is required for guest checkout.');
  END IF;

  -- Normalize Indian mobile numbers
  IF LENGTH(v_clean_phone) = 12 AND LEFT(v_clean_phone, 2) = '91' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 3);
  ELSIF LENGTH(v_clean_phone) = 11 AND LEFT(v_clean_phone, 1) = '0' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 2);
  ELSIF LENGTH(v_clean_phone) > 10 THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM LENGTH(v_clean_phone) - 9);
  END IF;

  -- 1. Check if user already exists in auth.users by email or phone
  SELECT id, email, phone, email_confirmed_at, phone_confirmed_at INTO v_user
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
    SELECT u.id, u.email, u.phone, u.email_confirmed_at, u.phone_confirmed_at INTO v_user
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.phone = v_clean_phone 
       OR p.phone = '+91' || v_clean_phone
       OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    LIMIT 1;
  END IF;

  -- 3. If user already exists: update contact info if needed, but DO NOT auto-confirm or return credentials
  IF v_user.id IS NOT NULL THEN
    IF v_clean_phone <> '' THEN
      UPDATE public.profiles
      SET phone = COALESCE(phone, v_clean_phone)
      WHERE id = v_user.id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user.id,
      'is_new_account', false,
      'email', v_user.email,
      'phone', COALESCE(v_user.phone, v_clean_phone),
      'is_verified', (v_user.email_confirmed_at IS NOT NULL)
    );
  END IF;

  -- 4. Create new passwordless user account in auth.users
  -- NOTE: encrypted_password is NULL; email_confirmed_at and phone_confirmed_at are strictly NULL.
  v_new_id := gen_random_uuid();

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
    NULLIF(v_clean_phone, ''),
    NULL,            -- Strictly passwordless: no password generated or stored
    NULL,            -- Strictly unverified: email_confirmed_at remains null until OTP/magic link verification
    NULL,            -- Strictly unverified: phone_confirmed_at remains null
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
      'email_verified', false,
      'phone_verified', false,
      'created_via', 'passwordless_guest_checkout'
    ),
    now(),
    now()
  );

  -- 5. Insert unverified identity into auth.identities
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
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    v_new_id::text,
    NULL,
    now(),
    now()
  );

  -- 6. Insert corresponding profile in public.profiles
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
    NULLIF(v_clean_phone, ''),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  -- 7. Assign customer role
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    v_new_id,
    'customer'::user_role_type
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_id,
    'is_new_account', true,
    'email', v_clean_email,
    'phone', v_clean_phone,
    'is_verified', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_user TO anon, authenticated, service_role;
