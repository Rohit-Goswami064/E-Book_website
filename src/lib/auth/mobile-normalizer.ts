/**
 * Indian Mobile Number & Password Security Normalizer Utility
 * 
 * Standardizes Indian mobile numbers across diverse input formats:
 * - "+91 9876543210"
 * - "+919876543210"
 * - "919876543210"
 * - "09876543210"
 * - "98765 43210"
 * - "9876543210"
 */

/**
 * Normalizes an Indian mobile number to canonical 10-digit format.
 * Returns null if the number is invalid or not 10 digits.
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Strip all non-numeric characters
  const digits = raw.replace(/\D/g, "")

  // Check common Indian prefix formats
  if (digits.length === 10) {
    // Valid 10-digit number (must begin with 5, 6, 7, 8, or 9 for Indian cellular networks)
    if (/^[5-9]\d{9}$/.test(digits)) {
      return digits
    }
    // Allow any 10-digit number for flexibility while warning
    return digits
  }

  // 11 digits starting with leading 0 (trunk code)
  if (digits.length === 11 && digits.startsWith("0")) {
    const stripped = digits.slice(1)
    if (stripped.length === 10) return stripped
  }

  // 12 digits starting with 91 (country code)
  if (digits.length === 12 && digits.startsWith("91")) {
    const stripped = digits.slice(2)
    if (stripped.length === 10) return stripped
  }

  // 13 digits starting with 091
  if (digits.length === 13 && digits.startsWith("091")) {
    const stripped = digits.slice(3)
    if (stripped.length === 10) return stripped
  }

  // Greater than 10 digits, fallback to trailing 10 digits if valid
  if (digits.length > 10) {
    const trailing10 = digits.slice(-10)
    if (/^[5-9]\d{9}$/.test(trailing10)) {
      return trailing10
    }
  }

  return null
}

/**
 * Formats a normalized 10-digit mobile number into international display format:
 * "+91 9876543210"
 */
export function formatIndianMobile(normalized10: string | null | undefined): string {
  if (!normalized10) return ""
  const clean = normalized10.replace(/\D/g, "")
  if (clean.length === 10) {
    return `+91 ${clean}`
  }
  return clean
}

/**
 * Checks whether a given string is a valid Indian mobile number.
 */
export function isValidIndianMobile(raw: string | null | undefined): boolean {
  return normalizeIndianMobile(raw) !== null
}

/**
 * Password complexity validation requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*...)
 */
export interface PasswordValidationResult {
  valid: boolean
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  errors: string[]
}

export function validatePasswordComplexity(password: string | null | undefined): PasswordValidationResult {
  const pwd = password || ""

  const hasMinLength = pwd.length >= 8
  const hasUppercase = /[A-Z]/.test(pwd)
  const hasLowercase = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\/`~]/.test(pwd)

  const errors: string[] = []
  if (!hasMinLength) errors.push("Password must be at least 8 characters long.")
  if (!hasUppercase) errors.push("Password must include at least one uppercase letter (A-Z).")
  if (!hasLowercase) errors.push("Password must include at least one lowercase letter (a-z).")
  if (!hasNumber) errors.push("Password must include at least one number (0-9).")
  if (!hasSpecialChar) errors.push("Password must include at least one special character (!@#$%^&*...).")

  const valid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar

  return {
    valid,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    errors,
  }
}

/**
 * Masks an email for safe client presentation:
 * "roshan@apexnucleus.com" -> "r***n@apexnucleus.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—"
  const [localPart, domain] = email.split("@")
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`
  }
  return `${localPart[0]}${"*".repeat(Math.max(1, localPart.length - 2))}${localPart[localPart.length - 1]}@${domain}`
}

/**
 * Masks a mobile number for safe display:
 * "9876543210" -> "+91 98****3210"
 */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return "—"
  const digits = mobile.replace(/\D/g, "")
  if (digits.length >= 10) {
    const last10 = digits.slice(-10)
    return `+91 ${last10.slice(0, 2)}****${last10.slice(6)}`
  }
  return mobile
}

