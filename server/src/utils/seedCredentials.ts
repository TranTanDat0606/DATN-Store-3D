export const SEED_PASSWORD_MIN_LENGTH = 12;

export interface SeedCredentialPlan {
  create: boolean;
  password?: string;
  reason?: 'env-missing' | 'password-weak';
}

/**
 * Seed accounts must never use a hardcoded or default password.
 * Passwords come exclusively from environment variables
 * (SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD) and are only
 * accepted when they meet the strength requirements below.
 * Anything else skips account creation.
 */
export function isStrongSeedPassword(password: string): boolean {
  return (
    password.length >= SEED_PASSWORD_MIN_LENGTH &&
    /\p{L}/u.test(password) &&
    /[0-9]/.test(password)
  );
}

export function resolveSeedCredential(envValue: string | undefined): SeedCredentialPlan {
  const password = envValue ?? '';
  if (password.trim() === '') {
    return { create: false, reason: 'env-missing' };
  }
  if (!isStrongSeedPassword(password)) {
    return { create: false, reason: 'password-weak' };
  }
  return { create: true, password };
}
