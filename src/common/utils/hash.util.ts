import { createHash, randomBytes } from 'crypto';

/** High-entropy tokens (refresh / password-reset tokens) don't need bcrypt — a fast, deterministic
 * digest is enough since they can't be brute-forced offline the way a human password can. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
