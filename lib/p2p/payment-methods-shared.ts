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
