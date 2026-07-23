"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { allNiches, nicheCategories, type Niche } from "@/lib/niches";

type NicheTagInputProps = {
  value: Niche[];
  onChange: (niches: Niche[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function NicheTagInput({ value, onChange, placeholder = "Search niches…", disabled = false }: NicheTagInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredByCategory = (() => {
    const q = query.toLowerCase().trim();
    const result: Array<{ category: string; niches: string[] }> = [];

    for (const [category, categoryNiches] of Object.entries(nicheCategories)) {
      const all = [...categoryNiches];
      const matches = q
        ? all.filter((n) => n.toLowerCase().includes(q) && !value.includes(n as Niche))
        : all.filter((n) => !value.includes(n as Niche));
      if (matches.length > 0) result.push({ category, niches: matches });
    }
    return result;
  })();

  const flatFiltered = filteredByCategory.flatMap((c) => c.niches);

  const addNiche = useCallback(
    (niche: Niche) => {
      if (!value.includes(niche)) {
        onChange([...value, niche]);
      }
      setQuery("");
      setHighlightIndex(-1);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const removeNiche = useCallback(
    (niche: Niche) => {
      onChange(value.filter((n) => n !== niche));
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        setHighlightIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < flatFiltered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : flatFiltered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
        addNiche(flatFiltered[highlightIndex] as Niche);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      removeNiche(value[value.length - 1]);
    }
  };

  const getHighlightCategoryIndex = (niche: string) => {
    let idx = 0;
    for (const c of filteredByCategory) {
      const pos = c.niches.indexOf(niche);
      if (pos !== -1) return idx + pos;
      idx += c.niches.length;
    }
    return -1;
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
            setIsOpen(true);
          }
        }}
        className={`flex min-h-[42px] flex-wrap items-center gap-1.5 border bg-white px-2.5 py-1.5 text-sm transition-colors ${
          isOpen ? "border-ocean" : "border-line"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-text"}`}
      >
        {value.map((niche) => (
          <span
            key={niche}
            className="inline-flex items-center gap-1 border border-ocean/30 bg-ocean/5 px-2 py-0.5 text-xs font-semibold text-ocean"
          >
            {niche}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeNiche(niche);
                }}
                className="ml-0.5 text-ocean/50 transition-colors hover:text-coral active:scale-90"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : "Add more…"}
          disabled={disabled}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted"
        />
        {value.length === 0 && !query && (
          <Search className="h-3.5 w-3.5 text-muted" />
        )}
      </div>

      {isOpen && flatFiltered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-[280px] w-full overflow-y-auto border border-line bg-white shadow-lg">
          {filteredByCategory.map((group) => (
            <div key={group.category}>
              <div className="sticky top-0 border-b border-line bg-panel px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                {group.category}
              </div>
              {group.niches.map((niche) => {
                const flatIdx = getHighlightCategoryIndex(niche);
                return (
                  <button
                    key={niche}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addNiche(niche as Niche);
                    }}
                    onMouseEnter={() => setHighlightIndex(flatIdx)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                      highlightIndex === flatIdx ? "bg-ocean/5 text-ink" : "text-muted hover:bg-ocean/5 hover:text-ink"
                    }`}
                  >
                    {niche}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {isOpen && query && flatFiltered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full border border-line bg-white px-3 py-4 text-center text-sm text-muted shadow-lg">
          No niches matching &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
