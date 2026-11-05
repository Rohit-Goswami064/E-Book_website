import { dbQuery } from "@/lib/db"
import { normalizeIndianMobile, validatePasswordComplexity } from "./mobile-normalizer"
import crypto from "crypto"

export interface CustomerAccountCheckResult {
  exists: boolean
  conflict: boolean
  conflictError?: string
  accountType: "new" | "existing" | "conflict"
  matchedBy: "none" | "email" | "phone" | "both"
  userId?: string
  email?: string
  phone?: string
  fullName?: string
  hasPassword?: boolean
}

/**
 * Authoritatively verifies whether a normalized mobile number or email address
 * already belongs to an existing user account in PostgreSQL (auth.users + public.profiles).
 * 
 * Strict Conflict Defense:
 * If the mobile number belongs to User A, but the email address belongs to User B,
 * marks `conflict: true` and blocks automated merging.
 */
export async function checkCustomerAccount(
  rawEmail?: string | null,
  rawMobile?: string | null
): Promise<CustomerAccountCheckResult> {
  const cleanEmail = rawEmail ? rawEmail.trim().toLowerCase() : null
  const cleanMobile = rawMobile ? normalizeIndianMobile(rawMobile) : null

  if (!cleanEmail && !cleanMobile) {
    return {
      exists: false,
      conflict: false,
      accountType: "new",
      matchedBy: "none",
    }
  }

  // 1. Check user matching email
  let userByEmail: { id: string; email: string; phone: string | null; full_name: string | null; has_password: boolean } | null = null
  if (cleanEmail) {
    const res = await dbQuery<{
      id: string
      email: string
      phone: string | null
      full_name: string | null
      has_password: boolean
    }>(
      `
      SELECT 
        u.id,
        u.email,
        COALESCE(u.phone, p.phone) as phone,
        COALESCE(p.full_name, u.raw_user_meta_data->>'full_name') as full_name,
        (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '') as has_password
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE LOWER(u.email) = LOWER($1::text)
      LIMIT 1;
      `,
      [cleanEmail]
    )
    if (res.rows.length > 0) {
      userByEmail = res.rows[0]
    }
  }

  // 2. Check user matching phone
  let userByPhone: { id: string; email: string; phone: string | null; full_name: string | null; has_password: boolean } | null = null
  if (cleanMobile) {
    const res = await dbQuery<{
      id: string
      email: string
      phone: string | null
      full_name: string | null
      has_password: boolean
    }>(
      `
      SELECT 
        u.id,
        u.email,
        COALESCE(u.phone, p.phone) as phone,
        COALESCE(p.full_name, u.raw_user_meta_data->>'full_name') as full_name,
        (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '') as has_password
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE (
        u.phone = $1::text
        OR u.phone = '+91' || $1::text
        OR REGEXP_REPLACE(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $1::text
        OR p.phone = $1::text
        OR p.phone = '+91' || $1::text
        OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = $1::text
      )
      LIMIT 1;
      `,
      [cleanMobile]
    )
    if (res.rows.length > 0) {
      userByPhone = res.rows[0]
    }
  }

  // 3. Conflict Detection: Mobile and Email belong to two DIFFERENT existing accounts
  if (userByEmail && userByPhone && userByEmail.id !== userByPhone.id) {
    return {
      exists: true,
      conflict: true,
      accountType: "conflict",
      matchedBy: "both",
      conflictError:
        "Account Conflict: The provided mobile number and email address belong to two different accounts. Please use matching credentials or sign in before proceeding.",
    }
  }

  // 4. Existing account matched by both or either
  const matchedUser = userByEmail || userByPhone
  if (matchedUser) {
    const matchedBy =
      userByEmail && userByPhone
        ? "both"
        : userByEmail
        ? "email"
        : "phone"

    return {
      exists: true,
      conflict: false,
      accountType: "existing",
      matchedBy,
      userId: matchedUser.id,
      email: matchedUser.email,
      phone: matchedUser.phone || cleanMobile || undefined,
      fullName: matchedUser.full_name || undefined,
      hasPassword: matchedUser.has_password,
    }
  }

  // 5. Neither exists: Brand new customer
  return {
    exists: false,
    conflict: false,
    accountType: "new",
    matchedBy: "none",
  }
}

/**
 * Cryptographically verifies an existing customer's password against auth.users in PostgreSQL.
 * Uses extensions.crypt (bcrypt blowfish bf) directly against stored encrypted_password.
 */
export async function verifyExistingUserPassword(
  userId: string,
  rawPassword: string
): Promise<boolean> {
  if (!userId || !rawPassword) return false

  try {
    const res = await dbQuery<{ is_valid: boolean }>(
      `
      SELECT (
        encrypted_password IS NOT NULL 
        AND encrypted_password <> '' 
        AND encrypted_password = extensions.crypt($1::text, encrypted_password)
      ) as is_valid
      FROM auth.users
      WHERE id = $2::uuid;
      `,
      [rawPassword, userId]
    )

    return Boolean(res.rows[0]?.is_valid)
  } catch (err) {
    console.error("[Verify Password DB Error]:", err)
    return false
  }
}

/**
 * Updates the password for an existing account (e.g. legacy account created without password).
 */
export async function updateCustomerPassword(
  userId: string,
  rawPassword: string
): Promise<boolean> {
  const complexity = validatePasswordComplexity(rawPassword)
  if (!complexity.valid) {
    throw new Error(complexity.errors[0] || "Password does not meet security requirements.")
  }

  await dbQuery(
    `
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt($1::text, extensions.gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
      updated_at = now()
    WHERE id = $2::uuid;
    `,
    [rawPassword, userId]
  )

  return true
}

/**
 * Securely provisions a new customer account in auth.users, auth.identities, public.profiles,
 * and public.user_roles with a bcrypt-hashed password.
 * 
 * NOTE: Does NOT create book entitlements. Entitlements are strictly granted only after
 * authorized, verified payment confirmation!
 */
export async function provisionNewCustomer(data: {
  email: string
  phone: string
  fullName: string
  password: string
}): Promise<{
  success: boolean
  isNewAccount: boolean
  userId: string
  email: string
  phone: string
}> {
  const cleanEmail = data.email.trim().toLowerCase()
  const cleanMobile = normalizeIndianMobile(data.phone)
  if (!cleanMobile) {
    throw new Error("A valid 10-digit Indian mobile number is required.")
  }

  const complexity = validatePasswordComplexity(data.password)
  if (!complexity.valid) {
    throw new Error(complexity.errors[0] || "Password does not meet security requirements.")
  }

  const newUserId = crypto.randomUUID()
  const fullName = data.fullName.trim()

  // 1. Create user in auth.users with bcrypt blowfish hash
  await dbQuery(
    `
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
      $1::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      $2::text,
      $3::text,
      extensions.crypt($4::text, extensions.gen_salt('bf', 10)),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object(
        'sub', $1::uuid::text,
        'full_name', $5::text,
        'phone', $3::text,
        'email', $2::text,
        'email_verified', true,
        'phone_verified', true,
        'created_via', 'instant_checkout'
      ),
      now(),
      now()
    );
    `,
    [newUserId, cleanEmail, cleanMobile, data.password, fullName]
  )

  // 2. Insert into auth.identities for GoTrue compatibility
  await dbQuery(
    `
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
      $1::uuid,
      jsonb_build_object(
        'sub', $1::uuid::text,
        'email', $2::text,
        'full_name', $3::text,
        'phone', $4::text,
        'email_verified', true
      ),
      'email',
      $1::uuid::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
    `,
    [newUserId, cleanEmail, fullName, cleanMobile]
  )

  // 3. Insert or update public.profiles
  await dbQuery(
    `
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      phone,
      created_at,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::text,
      $3::text,
      $4::text,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = EXCLUDED.phone,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      updated_at = now();
    `,
    [newUserId, cleanEmail, fullName, cleanMobile]
  )

  // 4. Assign customer role
  await dbQuery(
    `
    INSERT INTO public.user_roles (
      user_id,
      role
    ) VALUES (
      $1::uuid,
      'customer'::user_role_type
    )
    ON CONFLICT (user_id, role) DO NOTHING;
    `,
    [newUserId]
  )

  return {
    success: true,
    isNewAccount: true,
    userId: newUserId,
    email: cleanEmail,
    phone: cleanMobile,
  }
}

