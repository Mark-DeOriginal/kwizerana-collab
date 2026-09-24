export type SupportedMethod = {
  id: string;
  slug: string;
  name: string;
  category: string;
  risk_level: string;
  hold_period_minutes: number;
  is_active: boolean;
};

export type UserPaymentMethod = {
  id: string;
  method_type: string;
  method_name: string;
  details: Record<string, unknown>;
  account_holder_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type SupportedMethodSeed = {
  slug: string;
  name: string;
  category: string;
  risk_level: string;
  hold_period_minutes: number;
};

export type PaymentDetailField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
  autocomplete?: string;
};

const holder = (required = true): PaymentDetailField => ({
  key: "account_holder_name",
  label: "Account holder name",
  placeholder: "Name registered on the account",
  required,
  autocomplete: "name"
});

const methodFields: Record<string, PaymentDetailField[]> = {
  paypal: [
    { key: "email", label: "PayPal email", placeholder: "name@example.com", type: "email", required: true, autocomplete: "email" },
    holder(false)
  ],
  zelle: [
    { key: "emailOrPhone", label: "Zelle email or phone number", placeholder: "Email or US phone number", required: true },
    holder(false)
  ],
  "cash app": [
    { key: "accountHandle", label: "Cash App $Cashtag", placeholder: "$yourcashtag", required: true },
    holder(false)
  ],
  venmo: [
    { key: "accountHandle", label: "Venmo username", placeholder: "@username", required: true },
    holder(false)
  ],
  "interac e-transfer": [
    { key: "email", label: "Interac email", placeholder: "name@example.com", type: "email", required: true, autocomplete: "email" },
    holder(false)
  ],
  upi: [
    { key: "upiId", label: "UPI ID", placeholder: "name@bank", required: true },
    holder(false)
  ],
  pix: [
    { key: "pixKey", label: "Pix key", placeholder: "CPF, email, phone, or random key", required: true },
    holder(false)
  ],
  sepa: [
    holder(),
    { key: "iban", label: "IBAN", placeholder: "DE89 3704 0044 0532 0130 00", required: true },
    { key: "bic", label: "BIC / SWIFT", placeholder: "Optional BIC or SWIFT code" }
  ],
  swift: [
    holder(),
    { key: "accountNumber", label: "Account number or IBAN", placeholder: "Account number or IBAN", required: true },
    { key: "swiftCode", label: "SWIFT / BIC code", placeholder: "Bank SWIFT or BIC code", required: true }
  ]
};

export function getPaymentMethodFields(methodName: string, category: string): PaymentDetailField[] {
  const specific = methodFields[methodName.trim().toLowerCase()];
  if (specific) return specific;
  if (category === "mobile_money") {
    return [
      { key: "phoneNumber", label: "Registered phone number", placeholder: "Phone number linked to the account", type: "tel", required: true, autocomplete: "tel" },
      holder()
    ];
  }
  if (category === "digital_wallet") {
    return [
      { key: "walletId", label: "Account ID, username, or email", placeholder: "Identifier used to receive payment", required: true },
      holder(false)
    ];
  }
  return [
    holder(),
    { key: "accountNumber", label: "Account number", placeholder: "Bank account number", required: true }
  ];
}

export function paymentDetailValue(
  details: Record<string, unknown>,
  field: PaymentDetailField,
  accountHolderName?: string | null
): string {
  if (field.key === "account_holder_name") return accountHolderName ?? "";
  const value = details[field.key];
  if (typeof value === "string" && value.trim()) return value;
  // Compatibility with payment methods saved before method-specific fields. The
  // legacy identifier can represent a destination, but never a secondary code
  // such as SWIFT/BIC.
  const legacyIdentifierFields = new Set([
    "accountNumber", "phoneNumber", "walletId", "email", "emailOrPhone",
    "accountHandle", "upiId", "pixKey", "iban"
  ]);
  if (legacyIdentifierFields.has(field.key) && typeof details.accountIdentifier === "string") return details.accountIdentifier;
  return "";
}

export const SUPPORTED_METHODS: SupportedMethodSeed[] = [
  { slug: "local_bank_transfer", name: "Local Bank Transfer", category: "bank", risk_level: "medium", hold_period_minutes: 0 },
  { slug: "sepa", name: "SEPA", category: "bank", risk_level: "low", hold_period_minutes: 0 },
  { slug: "wire", name: "Wire Transfer", category: "bank", risk_level: "low", hold_period_minutes: 0 },
  { slug: "swift", name: "SWIFT", category: "bank", risk_level: "low", hold_period_minutes: 0 },
  { slug: "mtn_momo", name: "MTN MoMo", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "mpesa", name: "M-Pesa", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "airtel_money", name: "Airtel Money", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "opay", name: "OPay", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "palmpay", name: "PalmPay", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "gcash", name: "GCash", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "paytm", name: "Paytm", category: "mobile_money", risk_level: "low", hold_period_minutes: 0 },
  { slug: "paypal", name: "PayPal", category: "digital_wallet", risk_level: "high", hold_period_minutes: 1440 },
  { slug: "payeer", name: "Payeer", category: "digital_wallet", risk_level: "medium", hold_period_minutes: 0 },
  { slug: "advcash", name: "AdvCash", category: "digital_wallet", risk_level: "medium", hold_period_minutes: 0 },
  { slug: "in_person_cash", name: "In-Person Cash", category: "cash", risk_level: "high", hold_period_minutes: 0 }
];

export const PAYMENT_METHOD_CATEGORY_LABELS: Record<string, string> = {
  bank: "Bank Transfers",
  mobile_money: "Mobile Money",
  digital_wallet: "Digital Wallets",
  cash: "Cash"
};
