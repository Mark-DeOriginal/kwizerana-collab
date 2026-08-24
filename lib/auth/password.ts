import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Password must include at least one letter.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 320) return "Email is too long.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) return "Please enter a valid email address.";
  return null;
}
