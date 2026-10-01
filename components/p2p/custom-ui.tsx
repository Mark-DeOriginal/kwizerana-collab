"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MoreHorizontal } from "lucide-react";
import { formatThousandsInput, sanitizeDecimalInput } from "@/lib/p2p/number-format";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label?: string; options: SelectOption[] };

function useDropdownPosition({
  open,
  triggerRef,
  align,
  width
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  align: "left" | "right";
  width?: number;
}) {
  const [style, setStyle] = useState<CSSProperties>();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = width ?? rect.width;
    const viewportPadding = 8;
    const left = align === "right" ? rect.right - menuWidth : rect.left;
    const roomBelow = window.innerHeight - rect.bottom - 12;
    const roomAbove = rect.top - 12;
    const openAbove = roomBelow < 160 && roomAbove > roomBelow;

    setStyle({
      position: "fixed",
      top: openAbove ? undefined : rect.bottom + 4,
      bottom: openAbove ? window.innerHeight - rect.top + 4 : undefined,
      left: Math.min(Math.max(viewportPadding, left), window.innerWidth - menuWidth - viewportPadding),
      width: menuWidth,
      maxHeight: Math.max(80, openAbove ? roomAbove : roomBelow),
      zIndex: 10000
    });
  }, [align, triggerRef, width]);

  useEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return style;
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useDropdownPosition({ open, triggerRef, align });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const options = groups.flatMap((g) => g.options);
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${wrapperClassName ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 border border-line bg-white px-3 text-sm font-semibold outline-none transition-colors focus:border-ocean disabled:cursor-not-allowed disabled:opacity-60 ${triggerClassName ?? ""}`}
      >
        <span className={`truncate text-left ${selected ? "text-ink" : "text-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={menuStyle}
          className="overflow-auto rounded-md border border-line bg-white p-1 shadow-tight"
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
        </div>,
        document.body
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useDropdownPosition({ open, triggerRef, align, width: 208 });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-7 w-7 items-center justify-center border bg-white text-muted transition-colors ${
          open ? "border-ink text-ink" : "border-line hover:border-ocean focus:border-ocean hover:text-ink"
        }`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          className="overflow-auto rounded-md border border-line bg-white shadow-tight"
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
        </div>,
        document.body
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
