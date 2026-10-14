import { ALLOWED_EMAIL_DOMAIN } from '@/constants/auth';

export interface ParsedEmail {
  /** Lower-cased, trimmed address. */
  email: string;
  local: string;
  domain: string;
}

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;

// ASCII hostname: dot-separated labels of letters, digits and inner hyphens, at least two labels.
// Rejects trailing dots, empty labels, whitespace, zero-width/homoglyph characters and IDN lookalikes.
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Trim and lower-case an email. Returns null for non-strings and empty values. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Strictly parse an email into local part and domain.
 * Requires exactly one "@", a non-empty local part without whitespace, and a well-formed ASCII domain.
 */
export function parseEmail(value: unknown): ParsedEmail | null {
  const email = normalizeEmail(value);
  if (!email || email.length > MAX_EMAIL_LENGTH) return null;

  const parts = email.split('@');
  if (parts.length !== 2) return null;

  const [local, domain] = parts;
  if (!local || local.length > MAX_LOCAL_LENGTH || /\s/.test(local)) return null;
  if (!HOSTNAME_PATTERN.test(domain)) return null;

  return { email, local, domain };
}

/**
 * Exact-domain authorization check.
 *
 * Compares the whole domain for equality, so subdomains ("sub.hbplus.fit"), look-alikes
 * ("not-hbplus.fit") and suffix tricks ("hbplus.fit.attacker.com") are all rejected.
 * Never use includes()/endsWith() on the raw string for this decision.
 */
export function isAllowedEmailDomain(
  value: unknown,
  allowedDomain: string = ALLOWED_EMAIL_DOMAIN,
): boolean {
  const parsed = parseEmail(value);
  if (!parsed) return false;
  const allowed = normalizeEmail(allowedDomain);
  if (!allowed) return false;
  return parsed.domain === allowed;
}
