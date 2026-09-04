"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, ChevronDown, MoreHorizontal } from "lucide-react";
import { formatThousandsInput, sanitizeDecimalInput } from "@/lib/p2p/number-format";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label?: string; options: SelectOption[] };

export function CustomSelect({
  value,
  onChange,
  groups,
  placeholder = "Select…",
  disabled,
  align = "left",
  wrapperClassName,
  triggerClassName
}: {
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  wrapperClassName?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = groups.flatMap((g) => g.options);
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${wrapperClassName ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 border border-line bg-white px-3 text-sm font-semibold outline-none transition-colors focus:border-ocean disabled:cursor-not-allowed disabled:opacity-60 ${triggerClassName ?? ""}`}
      >
        <span className={`truncate text-left ${selected ? "text-ink" : "text-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full z-40 mt-1 max-h-64 min-w-full overflow-auto rounded-md border border-line bg-white p-1 shadow-tight ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {groups.map((group, gi) => (
            <div key={group.label ?? gi}>
              {group.label && group.options.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</p>
              )}
              {group.options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                      active ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
                    }`}
                  >
                    <span className="truncate text-left">{option.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-ocean" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OptionsMenu({
  items,
  align = "right"
}: {
  items: OptionsMenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        className={`flex h-7 w-7 items-center justify-center border bg-white text-muted transition-colors ${
          open ? "border-ink text-ink" : "border-line hover:border-ocean hover:text-ink"
        }`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-line bg-white shadow-tight ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="p-1">
            {items.map((item, i) =>
              "divider" in item ? (
                <div key={`d-${i}`} className="mx-1 my-1 border-t border-line" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                    item.danger
                      ? "text-coral hover:bg-coral/10"
                      : item.active
                        ? "bg-panel text-ink"
                        : "text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {item.icon}
                  <span className="truncate text-left">{item.label}</span>
                  {item.active && <Check className="ml-auto h-4 w-4 shrink-0 text-ocean" />}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type OptionsMenuItem =
  | {
      key: string;
      label: string;
      icon: ReactNode;
      active?: boolean;
      danger?: boolean;
      onClick: () => void;
    }
  | { key: string; divider: true };

export function NumInput({
  value,
  onValueChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "inputMode" | "autoComplete"> & {
  value: string;
  onValueChange: (raw: string) => void;
}) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={formatThousandsInput(value)}
      onChange={(e) => onValueChange(sanitizeDecimalInput(e.target.value))}
      className={className}
    />
  );
}