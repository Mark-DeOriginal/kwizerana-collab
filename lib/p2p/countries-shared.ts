export type PaymentMethodCategory = "bank" | "mobile_money" | "digital_wallet";

export type PaymentMethodOption = {
  name: string;
  category: PaymentMethodCategory;
};

export type Country = {
  code: string;
  name: string;
  currency: string;
  methods: PaymentMethodOption[];
};

const bank = (name: string): PaymentMethodOption => ({ name, category: "bank" });
const mobile = (name: string): PaymentMethodOption => ({ name, category: "mobile_money" });
const wallet = (name: string): PaymentMethodOption => ({ name, category: "digital_wallet" });

export const COUNTRIES: Country[] = [
  // Africa
  { code: "NG", name: "Nigeria", currency: "NGN", methods: [bank("Access Bank"), bank("First Bank"), bank("GTBank"), bank("Kuda Bank"), bank("UBA"), bank("Zenith Bank"), mobile("OPay"), mobile("PalmPay"), mobile("MTN MoMo")] },
  { code: "KE", name: "Kenya", currency: "KES", methods: [mobile("M-Pesa"), mobile("Airtel Money"), bank("Equity Bank"), bank("KCB Bank"), bank("Co-operative Bank")] },
  { code: "GH", name: "Ghana", currency: "GHS", methods: [mobile("MTN MoMo"), mobile("Vodafone Cash"), mobile("AirtelTigo Money"), bank("GCB Bank"), bank("Ecobank")] },
  { code: "ZA", name: "South Africa", currency: "ZAR", methods: [bank("FNB"), bank("Standard Bank"), bank("Absa"), bank("Capitec"), bank("Nedbank")] },
  { code: "UG", name: "Uganda", currency: "UGX", methods: [mobile("MTN MoMo"), mobile("Airtel Money"), bank("Stanbic Bank"), bank("Centenary Bank")] },
  { code: "EG", name: "Egypt", currency: "EGP", methods: [bank("National Bank of Egypt"), bank("Banque Misr"), mobile("Vodafone Cash"), wallet("Fawry")] },

  // Europe
  { code: "GB", name: "United Kingdom", currency: "GBP", methods: [bank("Barclays"), bank("HSBC"), bank("Lloyds Bank"), bank("NatWest"), wallet("Monzo"), wallet("Revolut"), bank("SEPA")] },
  { code: "DE", name: "Germany", currency: "EUR", methods: [bank("Deutsche Bank"), bank("Commerzbank"), wallet("N26"), bank("SEPA")] },
  { code: "FR", name: "France", currency: "EUR", methods: [bank("BNP Paribas"), bank("Société Générale"), bank("Crédit Agricole"), bank("SEPA")] },
  { code: "ES", name: "Spain", currency: "EUR", methods: [bank("Santander"), bank("BBVA"), bank("CaixaBank"), bank("SEPA")] },
  { code: "NL", name: "Netherlands", currency: "EUR", methods: [bank("ING"), bank("Rabobank"), bank("ABN AMRO"), bank("SEPA")] },
  { code: "IT", name: "Italy", currency: "EUR", methods: [bank("Intesa Sanpaolo"), bank("UniCredit"), bank("SEPA")] },

  // Americas
  { code: "US", name: "United States", currency: "USD", methods: [bank("Bank of America"), bank("Chase"), bank("Wells Fargo"), bank("Citibank"), wallet("Zelle"), wallet("Cash App"), wallet("Venmo"), wallet("PayPal")] },
  { code: "CA", name: "Canada", currency: "CAD", methods: [bank("RBC"), bank("TD Bank"), bank("Scotiabank"), bank("BMO"), wallet("Interac e-Transfer")] },
  { code: "BR", name: "Brazil", currency: "BRL", methods: [wallet("Pix"), wallet("Nubank"), bank("Itaú"), bank("Bradesco"), bank("Banco do Brasil")] },
  { code: "MX", name: "Mexico", currency: "MXN", methods: [bank("BBVA"), bank("Banorte"), bank("Santander"), wallet("SPEI"), wallet("OXXO")] },
  { code: "AR", name: "Argentina", currency: "ARS", methods: [wallet("Mercado Pago"), bank("Banco Galicia"), bank("BBVA"), wallet("Ualá")] },

  // Asia
  { code: "IN", name: "India", currency: "INR", methods: [wallet("UPI"), wallet("Paytm"), wallet("PhonePe"), bank("HDFC Bank"), bank("ICICI Bank"), bank("State Bank of India"), bank("Axis Bank")] },
  { code: "PH", name: "Philippines", currency: "PHP", methods: [mobile("GCash"), mobile("Maya"), bank("BDO"), bank("BPI"), bank("Metrobank"), bank("UnionBank")] },
  { code: "VN", name: "Vietnam", currency: "VND", methods: [bank("Vietcombank"), bank("Techcombank"), bank("MB Bank"), mobile("MoMo"), mobile("ZaloPay")] },
  { code: "TH", name: "Thailand", currency: "THB", methods: [bank("Kasikorn Bank"), bank("Siam Commercial Bank"), bank("Bangkok Bank"), wallet("PromptPay")] },
  { code: "ID", name: "Indonesia", currency: "IDR", methods: [bank("BCA"), bank("Mandiri"), bank("BRI"), wallet("GoPay"), wallet("OVO"), wallet("DANA")] },
  { code: "PK", name: "Pakistan", currency: "PKR", methods: [mobile("JazzCash"), mobile("EasyPaisa"), bank("HBL"), bank("UBL")] },

  // Middle East
  { code: "AE", name: "United Arab Emirates", currency: "AED", methods: [bank("Emirates NBD"), bank("First Abu Dhabi Bank"), bank("ADCB"), bank("Mashreq Bank")] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", methods: [bank("Al Rajhi Bank"), bank("SNB"), bank("Riyad Bank"), wallet("stc pay")] }
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export const PAYMENT_METHOD_CATEGORY_LABELS: Record<PaymentMethodCategory, string> = {
  bank: "Bank",
  mobile_money: "Mobile Money",
  digital_wallet: "Digital Wallet"
};

export function getCurrencyMethods(currency: string): PaymentMethodOption[] {
  const seen = new Set<string>();
  const methods: PaymentMethodOption[] = [];
  for (const country of COUNTRIES) {
    if (country.currency !== currency) continue;
    for (const m of country.methods) {
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      methods.push(m);
    }
  }
  return methods;
}
