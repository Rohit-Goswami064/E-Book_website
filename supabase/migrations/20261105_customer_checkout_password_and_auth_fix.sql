-- Migration: 20261105_customer_checkout_password_and_auth_fix.sql
-- Description: Comprehensive fix for HiddenBooks Customer Checkout, Password Handling,
--              Login Resolution, Account Linking, and Authoritative Entitlement Access.

-- 1. Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enhanced Indian Mobile Number & Identifier Resolution Function
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
  -- A. If identifier contains '@', it's an email
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

  -- B. It's a mobile number: Normalize Indian country codes and trunk prefixes
  IF LENGTH(v_clean_phone) = 13 AND LEFT(v_clean_phone, 3) = '091' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 4);
  ELSIF LENGTH(v_clean_phone) = 12 AND LEFT(v_clean_phone, 2) = '91' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 3);
  ELSIF LENGTH(v_clean_phone) = 11 AND LEFT(v_clean_phone, 1) = '0' THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM 2);
  ELSIF LENGTH(v_clean_phone) > 10 THEN
    v_clean_phone := SUBSTRING(v_clean_phone FROM LENGTH(v_clean_phone) - 9);
  END IF;

  IF LENGTH(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid mobile number format');
  END IF;

  -- C. Check public.profiles first (where customer phone numbers are maintained)
  SELECT id, email, phone INTO v_user
  FROM public.profiles
  WHERE phone = v_clean_phone
     OR phone = '+91' || v_clean_phone
     OR phone = '+91 ' || v_clean_phone
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

  -- D. Check auth.users as authoritative fallback
  SELECT id, email, phone INTO v_user
  FROM auth.users
  WHERE phone = v_clean_phone
     OR phone = '+91' || v_clean_phone
     OR phone = '+91 ' || v_clean_phone
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

-- 3. Password Verification Function for Authenticating Existing Customers During Checkout
CREATE OR REPLACE FUNCTION public.verify_checkout_user_password(
  p_user_id uuid,
  p_raw_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_raw_password IS NULL OR TRIM(p_raw_password) = '' THEN
    RETURN false;
  END IF;

  SELECT (
    encrypted_password IS NOT NULL 
    AND encrypted_password <> '' 
    AND encrypted_password = extensions.crypt(p_raw_password, encrypted_password)
  ) INTO v_valid
  FROM auth.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_valid, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_checkout_user_password(uuid, text) TO anon, authenticated, service_role;

