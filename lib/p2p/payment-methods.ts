import { dbQuery, ensureDatabase } from "@/lib/db";
import type { SupportedMethod, SupportedMethodSeed, UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import { getPaymentMethodFields, paymentDetailValue, SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

export type { SupportedMethod, SupportedMethodSeed, UserPaymentMethod };
export { PAYMENT_METHOD_CATEGORY_LABELS, SUPPORTED_METHODS } from "@/lib/p2p/payment-methods-shared";

export type PaymentMethodAccount = {
  id: string;
  name: string;
  fiatCurrency: string | null;
  isManaged: boolean;
  methods: UserPaymentMethod[];
};

async function resolvePaymentMethodTarget(userId: string, requestedId?: string | null): Promise<string | null> {
  const targetId = requestedId?.trim() || userId;
  const rows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM users
     WHERE id = $2 AND (id = $1 OR owner_user_id = $1)
     LIMIT 1`,
    [userId, targetId]
  );
  return rows[0]?.id ?? null;
}

export async function listPaymentMethodAccounts(userId: string): Promise<PaymentMethodAccount[]> {
  await ensureDatabase();
  const allAccounts = await dbQuery<{ id: string; name: string; fiat_currency: string | null; is_managed: boolean }>(
    `SELECT u.id::TEXT AS id, u.name,
            (SELECT a.fiat_currency FROM p2p_ads a WHERE a.user_id = u.id ORDER BY a.created_at ASC LIMIT 1) AS fiat_currency,
            (u.id <> $1)::BOOLEAN AS is_managed
     FROM users u
     WHERE u.id = $1 OR u.owner_user_id = $1
     ORDER BY is_managed ASC, u.name ASC`,
    [userId]
  );
  // Owners operate through their managed storefronts instead of appearing as
  // an extra personal vendor. Ordinary vendors still receive their own account.
  const managedAccounts = allAccounts.filter((account) => account.is_managed);
  const accounts = managedAccounts.length > 0 ? managedAccounts : allAccounts;
  const ids = accounts.map((account) => account.id);
  const rows = ids.length === 0 ? [] : await dbQuery<(Omit<UserPaymentMethod, "details"> & { user_id: string; details: string })>(
    `SELECT id::TEXT AS id, user_id, method_type, method_name, details::TEXT AS details,
            account_holder_name, is_verified, created_at, updated_at
     FROM p2p_payment_methods
     WHERE user_id = ANY($1) AND is_active = TRUE
     ORDER BY created_at DESC`,
    [ids]
  );
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    fiatCurrency: account.fiat_currency,
    isManaged: account.is_managed,
    methods: rows.filter((row) => row.user_id === account.id).map(({ user_id: _userId, ...row }) => ({ ...row, details: parseDetails(row.details) }))
  }));
}

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
     WHERE user_id = $1 AND is_active = TRUE
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
  if (!input.details || typeof input.details !== "object" || Array.isArray(input.details)) return "Payment details are required.";
  if (JSON.stringify(input.details).length > 4000) return "Payment details are too long.";

  const fields = getPaymentMethodFields(input.method_name, input.method_type);
  for (const field of fields) {
    const value = paymentDetailValue(input.details, field, input.account_holder_name).trim();
    if (field.required && !value) return `${field.label} is required.`;
    if (value.length > 200) return `${field.label} is too long.`;
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `Enter a valid ${field.label.toLowerCase()}.`;
    }
  }
  return null;
}

export async function createPaymentMethod(userId: string, input: PaymentMethodInput, requestedOwnerId?: string | null): Promise<UserPaymentMethod> {
  await ensureDatabase();
  const ownerId = await resolvePaymentMethodTarget(userId, requestedOwnerId);
  if (!ownerId) throw new Error("You cannot manage payment methods for this vendor.");
  const rows = await dbQuery<Omit<UserPaymentMethod, "details"> & { details: string }>(
    `INSERT INTO p2p_payment_methods (user_id, method_type, method_name, account_holder_name, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, method_type, method_name, details::TEXT AS details, account_holder_name, is_verified, created_at, updated_at`,
    [ownerId, input.method_type.trim(), input.method_name.trim(), input.account_holder_name ?? null, JSON.stringify(input.details)]
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
     WHERE id = $1 AND is_active = TRUE
       AND user_id IN (SELECT id FROM users WHERE id = $2 OR owner_user_id = $2)
     RETURNING id, method_type, method_name, details::TEXT AS details, account_holder_name, is_verified, created_at, updated_at`,
    [methodId, userId, input.method_type.trim(), input.method_name.trim(), input.account_holder_name ?? null, JSON.stringify(input.details)]
  );
  if (!rows[0]) return null;
  return { ...rows[0], details: parseDetails(rows[0].details) };
}

export async function deletePaymentMethod(userId: string, methodId: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ id: string }>(
    `UPDATE p2p_payment_methods
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND is_active = TRUE
       AND user_id IN (SELECT id FROM users WHERE id = $2 OR owner_user_id = $2)
     RETURNING id`,
    [methodId, userId]
  );
  return rows.length > 0;
}
