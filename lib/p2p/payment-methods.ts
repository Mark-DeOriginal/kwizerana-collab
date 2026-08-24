import { dbQuery, ensureDatabase } from "@/lib/db";
import type { SupportedMethod, SupportedMethodSeed, UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import { SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

export type { SupportedMethod, SupportedMethodSeed, UserPaymentMethod };
export { PAYMENT_METHOD_CATEGORY_LABELS, SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

export async function listSupportedMethods(): Promise<SupportedMethod[]> {
  await ensureDatabase();
  return dbQuery<SupportedMethod>(
    `SELECT id, slug, name, category, risk_level, hold_period_minutes, is_active
     FROM p2p_supported_methods
     WHERE is_active = TRUE
     ORDER BY category ASC, name ASC`
  );
}

export async function listUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]> {
  await ensureDatabase();
  const rows = await dbQuery<Omit<UserPaymentMethod, "details"> & { details: string }>(
    `SELECT id, method_type, method_name, details::TEXT AS details, account_holder_name, is_verified, created_at, updated_at
     FROM p2p_payment_methods
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({ ...row, details: parseDetails(row.details) }));
}

function parseDetails(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type PaymentMethodInput = {
  method_type: string;
  method_name: string;
  account_holder_name?: string | null;
  details: Record<string, unknown>;
};

export function validatePaymentMethodInput(input: PaymentMethodInput): string | null {
  if (!input.method_type || !input.method_type.trim()) return "Payment method type is required.";
  if (!input.method_name || !input.method_name.trim()) return "Payment method name is required.";
  if (input.method_name.length > 100) return "Payment method name is too long.";
  if (input.account_holder_name && input.account_holder_name.length > 120) return "Account holder name is too long.";
  return null;
}

export async function createPaymentMethod(userId: string, input: PaymentMethodInput): Promise<UserPaymentMethod> {
  await ensureDatabase();
  const rows = await dbQuery<Omit<UserPaymentMethod, "details"> & { details: string }>(
    `INSERT INTO p2p_payment_methods (user_id, method_type, method_name, account_holder_name, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, method_type, method_name, details::TEXT AS details, account_holder_name, is_verified, created_at, updated_at`,
    [userId, input.method_type.trim(), input.method_name.trim(), input.account_holder_name ?? null, JSON.stringify(input.details)]
  );
  const row = rows[0];
  return { ...row, details: parseDetails(row.details) };
}

export async function updatePaymentMethod(
  userId: string,
  methodId: string,
  input: PaymentMethodInput
): Promise<UserPaymentMethod | null> {
  await ensureDatabase();
  const rows = await dbQuery<Omit<UserPaymentMethod, "details"> & { details: string }>(
    `UPDATE p2p_payment_methods
     SET method_type = $3, method_name = $4, account_holder_name = $5, details = $6::jsonb, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, method_type, method_name, details::TEXT AS details, account_holder_name, is_verified, created_at, updated_at`,
    [methodId, userId, input.method_type.trim(), input.method_name.trim(), input.account_holder_name ?? null, JSON.stringify(input.details)]
  );
  if (!rows[0]) return null;
  return { ...rows[0], details: parseDetails(rows[0].details) };
}

export async function deletePaymentMethod(userId: string, methodId: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM p2p_payment_methods WHERE id = $1 AND user_id = $2 RETURNING id`,
    [methodId, userId]
  );
  return rows.length > 0;
}
