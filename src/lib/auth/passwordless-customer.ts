import { dbQuery } from "@/lib/db"
import { normalizeIndianMobile } from "./mobile-normalizer"
import crypto from "crypto"

export interface PasswordlessCustomerResult {
  userId: string
  email: string
  isNewAccount: boolean
  phone: string | null
  fullName: string | null
}

export interface PasswordlessCustomerInput {
  email?: string | null
  phone?: string | null
  fullName?: string | null
}

/**
 * Express Checkout: Resolves an existing user by phone or email, or provisions a new passwordless user account.
 * Eliminates all password and registration friction during eBook checkout.
 */
export async function getOrCreatePasswordlessCustomer(
  input: string | PasswordlessCustomerInput,
  fallbackFullName?: string | null,
  fallbackPhone?: string | null
): Promise<PasswordlessCustomerResult> {
  let rawEmail: string | null = null
  let rawPhone: string | null = null
  let rawFullName: string | null = null

  if (typeof input === "string") {
    if (input.includes("@")) {
      rawEmail = input
      rawFullName = fallbackFullName || null
      rawPhone = fallbackPhone || null
    } else {
      rawPhone = input
      rawFullName = fallbackFullName || null
    }
  } else if (input && typeof input === "object") {
    rawEmail = input.email || null
    rawPhone = input.phone || fallbackPhone || null
    rawFullName = input.fullName || fallbackFullName || null
  }

  const cleanMobile = rawPhone ? normalizeIndianMobile(rawPhone) : null
  const cleanEmail = rawEmail && rawEmail.includes("@") ? rawEmail.trim().toLowerCase() : null

  if (!cleanMobile && !cleanEmail) {
    throw new Error("A valid mobile number or email address is required for checkout.")
  }

  // 1. Check if user already exists by phone (if provided)
  if (cleanMobile) {
    const phoneRes = await dbQuery<{
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

    if (phoneRes.rows.length > 0) {
      const existing = phoneRes.rows[0]

      // If user has no password set, assign temporary password as their mobile number
      if (!existing.has_password && cleanMobile) {
        await dbQuery(
          `
          UPDATE auth.users 
          SET 
            encrypted_password = extensions.crypt($1::text, extensions.gen_salt('bf', 10)),
            raw_user_meta_data = jsonb_set(
              COALESCE(raw_user_meta_data, '{}'::jsonb),
              '{is_temp_password}',
              'true'::jsonb
            ),
            updated_at = now()
          WHERE id = $2::uuid;
          `,
          [cleanMobile, existing.id]
        )
      }

      return {
        userId: existing.id,
        email: existing.email || (cleanEmail ? cleanEmail : `${cleanMobile}@hiddenbooks.in`),
        isNewAccount: false,
        phone: existing.phone || cleanMobile,
        fullName: existing.full_name || rawFullName || null,
      }
    }
  }

  // 2. Check if user already exists by email (if provided)
  if (cleanEmail) {
    const emailRes = await dbQuery<{
      id: string
      email: string
      phone: string | null
      full_name: string | null
    }>(
      `
      SELECT 
        u.id,
        u.email,
        COALESCE(u.phone, p.phone) as phone,
        COALESCE(p.full_name, u.raw_user_meta_data->>'full_name') as full_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE LOWER(u.email) = LOWER($1::text)
      LIMIT 1;
      `,
      [cleanEmail]
    )

    if (emailRes.rows.length > 0) {
      const existing = emailRes.rows[0]
      if (cleanMobile && !existing.phone) {
        await dbQuery(
          `UPDATE public.profiles SET phone = $1::text WHERE id = $2::uuid;`,
          [cleanMobile, existing.id]
        )
      }
      return {
        userId: existing.id,
        email: existing.email || cleanEmail,
        isNewAccount: false,
        phone: existing.phone || cleanMobile,
        fullName: existing.full_name || rawFullName || null,
      }
    }
  }

  // 3. Provision new passwordless user in auth.users
  const newUserId = crypto.randomUUID()
  const finalEmail =
    cleanEmail ||
    (cleanMobile ? `${cleanMobile}@hiddenbooks.in` : `${newUserId.slice(0, 8)}@hiddenbooks.in`)
  const finalPhone = cleanMobile || null
  const displayName =
    rawFullName?.trim() || (cleanMobile ? `User ${cleanMobile.slice(-4)}` : "Customer")

  const tempPassword = cleanMobile || newUserId.slice(0, 10)

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
      extensions.crypt($5::text, extensions.gen_salt('bf', 10)),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '{"provider": "email", "providers": ["email", "phone"]}'::jsonb,
      jsonb_build_object(
        'sub', $1::uuid::text,
        'full_name', $4::text,
        'phone', $3::text,
        'email', $2::text,
        'phone_verified', true,
        'email_verified', true,
        'created_via', 'express_checkout',
        'is_temp_password', true
      ),
      now(),
      now()
    );
    `,
    [newUserId, finalEmail, finalPhone, displayName, tempPassword]
  )

  // 4. Insert into auth.identities
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
        'phone', $3::text,
        'email', $2::text,
        'full_name', $4::text
      ),
      'email',
      $1::uuid::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
    `,
    [newUserId, finalEmail, finalPhone, displayName]
  )

  // 5. Insert or update public.profiles
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
      $4::text,
      $3::text,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
      email = COALESCE(public.profiles.email, EXCLUDED.email),
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      updated_at = now();
    `,
    [newUserId, finalEmail, finalPhone, displayName]
  )

  // 6. Assign customer role in public.user_roles
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
    userId: newUserId,
    email: finalEmail,
    isNewAccount: true,
    phone: finalPhone,
    fullName: displayName,
  }
}

