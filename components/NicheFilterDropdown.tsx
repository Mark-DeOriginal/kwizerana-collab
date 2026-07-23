"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { allNiches, nicheCategories, type Niche } from "@/lib/niches";

type NicheFilterDropdownProps = {
  value: Niche[];
  onToggle: (niche: Niche) => void;
  onClear: () => void;
};

export function NicheFilterDropdown({ value, onToggle, onClear }: NicheFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredByCategory = (() => {
    const q = query.toLowerCase().trim();
    const result: Array<{ category: string; niches: string[] }> = [];
    for (const [category, categoryNiches] of Object.entries(nicheCategories)) {
      const matches = q
        ? [...categoryNiches].filter((n) => n.toLowerCase().includes(q))
        : [...categoryNiches];
      if (matches.length > 0) result.push({ category, niches: matches });
    }
    return result;
  })();

  const flatFiltered = filteredByCategory.flatMap((c) => c.niches);

  const getHighlightIndex = (niche: string) => {
    let idx = 0;
    for (const c of filteredByCategory) {
      const pos = c.niches.indexOf(niche);
      if (pos !== -1) return idx + pos;
      idx += c.niches.length;
    }
    return -1;
  };

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < flatFiltered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : flatFiltered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
        onToggle(flatFiltered[highlightIndex] as Niche);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs font-semibold transition-colors ${
          value.length > 0 ? "border-moss bg-mint text-ink" : "border-line bg-white text-muted hover:border-ocean"
        }`}
      >
        Niches{value.length > 0 && ` (${value.length})`}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-[300px] border border-line bg-white shadow-lg">
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search niches…"
              className="h-8 w-full border border-line bg-panel px-2 text-sm outline-none placeholder:text-muted focus:border-ocean"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {filteredByCategory.map((group) => (
              <div key={group.category}>
                <div className="sticky top-0 border-b border-line bg-panel px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {group.category}
                </div>
                {group.niches.map((niche) => {
                  const idx = getHighlightIndex(niche);
                  const active = value.includes(niche as Niche);
                  return (
                    <button
                      key={niche}
                      type="button"
                      onClick={() => onToggle(niche as Niche)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        active ? "bg-ocean/10 text-ocean" : highlightIndex === idx ? "bg-ocean/5 text-ink" : "text-muted hover:bg-ocean/5 hover:text-ink"
                      }`}
                    >
                      <span>{niche}</span>
                      {active && <X className="h-3 w-3 shrink-0 text-ocean" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {flatFiltered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
