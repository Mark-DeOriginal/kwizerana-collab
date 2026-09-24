"use client";

import { getPaymentMethodFields } from "@/lib/p2p/payment-methods-shared";

type Props = {
  methodName: string;
  methodType: string;
  accountHolderName: string;
  details: Record<string, string>;
  onAccountHolderNameChange: (value: string) => void;
  onDetailsChange: (details: Record<string, string>) => void;
  idPrefix: string;
  compact?: boolean;
};

export function PaymentDetailFields({
  methodName,
  methodType,
  accountHolderName,
  details,
  onAccountHolderNameChange,
  onDetailsChange,
  idPrefix,
  compact = false
}: Props) {
  if (!methodName || !methodType) return null;

  return (
    <>
      {getPaymentMethodFields(methodName, methodType).map((field) => {
        const isHolder = field.key === "account_holder_name";
        const value = isHolder ? accountHolderName : details[field.key] ?? "";
        const inputId = `${idPrefix}-${field.key}`;
        return (
          <div key={field.key}>
            <label htmlFor={inputId} className={`mb-1 block font-semibold uppercase tracking-wide text-muted ${compact ? "text-[11px]" : "text-xs"}`}>
              {field.label}{!field.required && <span className="normal-case text-muted/70"> (optional)</span>}
            </label>
            <input
              id={inputId}
              type={field.type ?? "text"}
              autoComplete={field.autocomplete}
              value={value}
              required={field.required}
              onChange={(event) => {
                if (isHolder) onAccountHolderNameChange(event.target.value);
                else onDetailsChange({ ...details, [field.key]: event.target.value });
              }}
              className={`${compact ? "h-10" : "h-11"} w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean`}
              placeholder={field.placeholder}
            />
          </div>
        );
      })}
    </>
  );
}
