export type Currency = {
  id: string;
  code: string;
  name: string;
  region: string;
  is_fiat: boolean;
  is_active: boolean;
};

export type CurrencyRate = {
  crypto_currency: string;
  fiat_currency: string;
  rate: string;
  updated_at: string;
};

export type FiatSeed = { code: string; name: string; region: string };

export const CRYPTO_CURRENCIES = ["USDT", "USDC"];

export const FIAT_CURRENCIES: FiatSeed[] = [
  { code: "NGN", name: "Nigerian Naira", region: "Africa" },
  { code: "KES", name: "Kenyan Shilling", region: "Africa" },
  { code: "GHS", name: "Ghanaian Cedi", region: "Africa" },
  { code: "ZAR", name: "South African Rand", region: "Africa" },
  { code: "UGX", name: "Ugandan Shilling", region: "Africa" },
  { code: "EUR", name: "Euro", region: "Europe" },
  { code: "GBP", name: "British Pound", region: "Europe" },
  { code: "USD", name: "US Dollar", region: "Americas" },
  { code: "CAD", name: "Canadian Dollar", region: "Americas" },
  { code: "INR", name: "Indian Rupee", region: "Asia" },
  { code: "PHP", name: "Philippine Peso", region: "Asia" },
  { code: "VND", name: "Vietnamese Dong", region: "Asia" },
  { code: "THB", name: "Thai Baht", region: "Asia" },
  { code: "AED", name: "UAE Dirham", region: "Middle East" },
  { code: "SAR", name: "Saudi Riyal", region: "Middle East" }
];

// Approximate initial rates: fiat units per 1 USDT/USDC.
// Refreshed by the live price feed in Phase 2.
export const SEED_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 1.36,
  NGN: 1600,
  KES: 129,
  GHS: 15.5,
  ZAR: 18.5,
  UGX: 3700,
  INR: 84,
  PHP: 58,
  VND: 25000,
  THB: 34,
  AED: 3.67,
  SAR: 3.75
};
