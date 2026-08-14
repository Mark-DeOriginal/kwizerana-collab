"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Check,
  GripVertical,
  Loader2,
  Plus,
  Search,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import type { RankingBoard, RankingBoardWithEntries } from "@/lib/rankings";
import { formatFollowers } from "@/lib/format";
import { friendlyError, readJson } from "@/lib/client-request";

type SearchResult = {
  id: number;
  handle: string;
  name: string;
  followers: number;
  verified: boolean;
  profile_image_url: string | null;
};

type SlotState = { position: number; influencer: SearchResult | null };

export function RankingsTab() {
  const [boards, setBoards] = useState<RankingBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<RankingBoardWithEntries | null>(null);
  const [topLevelNiches, setTopLevelNiches] = useState<string[]>([]);
  const [rankDepth, setRankDepth] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newNiche, setNewNiche] = useState("");
  const [newSubNiche, setNewSubNiche] = useState("");
  const [creating, setCreating] = useState(false);

  const [slots, setSlots] = useState<SlotState[]>([]);
  const [searchQuery, setSearchQuery] = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, SearchResult[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});
  const [openSearch, setOpenSearch] = useState<Record<number, boolean>>({});
  const searchRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rankings/boards");
      const payload = (await readJson<{ boards?: RankingBoard[]; topLevelNiches?: string[]; rankDepth?: number; error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to load rankings.");
      setBoards(payload.boards ?? []);
      setTopLevelNiches(payload.topLevelNiches ?? []);
      setRankDepth(payload.rankDepth ?? 10);
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!selectedBoardId) return;
    setLoading(true);
    setError("");
    setJustSaved(false);
    fetch(`/api/rankings/boards/${selectedBoardId}`)
      .then((res) => readJson<{ board?: RankingBoardWithEntries; error?: string }>(res))
      .then((payload) => {
        if (!payload) throw new Error("Failed to load board.");
        if (!payload.board) throw new Error(payload.error ?? "Failed to load board.");
        setBoard(payload.board);
        setSlots(
          Array.from({ length: rankDepth }, (_, i) => {
            const pos = i + 1;
            const entry = (payload.board?.entries ?? []).find((e: { position: number }) => e.position === pos);
            const inf = entry?.influencer as SearchResult | undefined;
            return { position: pos, influencer: inf ?? null };
          })
        );
        setOpenSearch({});
        setSearchQuery({});
        setSearchResults({});
      })
      .catch((err: unknown) => {
        setError(friendlyError(err, "Failed to load board."));
      })
      .finally(() => setLoading(false));
  }, [selectedBoardId, rankDepth]);

  const handleCreate = async () => {
    const niche = newNiche.trim();
    if (!niche) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/rankings/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, sub_niche: newSubNiche.trim() })
      });
      const payload = (await readJson<{ board?: RankingBoard; error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to create board.");
      await loadBoards();
      setSelectedBoardId(payload.board?.id ?? null);
      setShowCreate(false);
      setNewNiche("");
      setNewSubNiche("");
    } catch (err: unknown) {
      setError(friendlyError(err, "Failed to create board."));
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBoardId) return;
    setSaving(true);
    setError("");
    try {
      const entries = slots
        .filter((s) => s.influencer)
        .map((s) => ({ position: s.position, influencerId: s.influencer!.id }));
      const res = await fetch(`/api/rankings/boards/${selectedBoardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });
      const payload = (await readJson<{ board?: RankingBoardWithEntries; error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to save ranking.");
      setBoard(payload.board ?? null);
      await loadBoards();
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    } catch (err: unknown) {
      setError(friendlyError(err, "Failed to save ranking."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBoardId) return;
    if (!confirm("Delete this ranking board and all its entries?")) return;
    setError("");
    try {
      const res = await fetch(`/api/rankings/boards/${selectedBoardId}`, { method: "DELETE" });
      const payload = (await readJson<{ error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete board.");
      setSelectedBoardId(null);
      setBoard(null);
      setSlots([]);
      await loadBoards();
    } catch (err: unknown) {
      setError(friendlyError(err, "Failed to delete board."));
    }
  };

  const assignToSlot = (position: number, influencer: SearchResult) => {
    setSlots((prev) => prev.map((s) => (s.position === position ? { ...s, influencer } : s)));
    setOpenSearch((prev) => ({ ...prev, [position]: false }));
    setSearchQuery((prev) => ({ ...prev, [position]: "" }));
  };

  const startReplace = (position: number) => {
    setSlots((prev) => prev.map((s) => (s.position === position ? { ...s, influencer: null } : s)));
    setSearchQuery((prev) => ({ ...prev, [position]: "" }));
    setOpenSearch((prev) => ({ ...prev, [position]: true }));
  };

  const clearSlot = (position: number) => {
    setSlots((prev) => prev.map((s) => (s.position === position ? { ...s, influencer: null } : s)));
    setOpenSearch((prev) => ({ ...prev, [position]: false }));
  };

  const swapSlots = (posA: number, posB: number) => {
    setSlots((prev) => {
      const a = prev.find((s) => s.position === posA);
      const b = prev.find((s) => s.position === posB);
      return prev.map((s) => {
        if (s.position === posA) return { ...s, influencer: b?.influencer ?? null };
        if (s.position === posB) return { ...s, influencer: a?.influencer ?? null };
        return s;
      });
    });
  };

  const getInfluencerInSlot = (position: number) => {
    return slots.find((s) => s.position === position)?.influencer ?? null;
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const pos of Object.keys(searchQuery)) {
      const p = Number(pos);
      const q = searchQuery[p] ?? "";
      if (!q) {
        setSearchResults((prev) => ({ ...prev, [p]: [] }));
        continue;
      }
      const timer = setTimeout(async () => {
        setSearchLoading((prev) => ({ ...prev, [p]: true }));
        try {
          const res = await fetch(`/api/influencers/search?q=${encodeURIComponent(q)}`);
          const payload = await res.json();
          if (res.ok) setSearchResults((prev) => ({ ...prev, [p]: payload.results ?? [] }));
          else setSearchResults((prev) => ({ ...prev, [p]: [] }));
        } catch {
          setSearchResults((prev) => ({ ...prev, [p]: [] }));
        } finally {
          setSearchLoading((prev) => ({ ...prev, [p]: false }));
        }
      }, 300);
      timers.push(timer);
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [searchQuery]);

  useEffect(() => {
    for (const posStr of Object.keys(openSearch)) {
      const pos = Number(posStr);
      if (openSearch[pos]) {
        inputRefs.current[pos]?.focus();
      }
    }
  }, [openSearch]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      for (const posStr of Object.keys(openSearch)) {
        const pos = Number(posStr);
        if (openSearch[pos] && searchRefs.current[pos] && !searchRefs.current[pos]!.contains(e.target as Node)) {
          setOpenSearch((prev) => ({ ...prev, [pos]: false }));
        }
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [openSearch]);

  return (
    <div>
      {error && (
        <div className="mb-4 border border-coral/40 bg-coral/10 p-3 text-sm font-medium text-ink">{error}</div>
      )}

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Influencer rankings</h2>
          <p className="text-sm text-muted">Build topic leaderboards shown on the landing page.</p>
        </div>
      </div>

      {showCreate && (
        <div className="mb-5 border border-ocean/40 bg-ocean/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Create a new board</p>
            <button
              onClick={() => setShowCreate(false)}
              className="grid h-6 w-6 place-items-center text-muted transition-colors hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-muted">
              Niche (topic)
              <input
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
                list="top-niches"
                placeholder="e.g. Crypto"
                className="h-10 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              />
              <datalist id="top-niches">
                {topLevelNiches.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-muted">
              Sub-niche (optional)
              <input
                value={newSubNiche}
                onChange={(e) => setNewSubNiche(e.target.value)}
                placeholder="e.g. Solana"
                className="h-10 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              />
            </label>
            <button
              onClick={handleCreate}
              disabled={creating || !newNiche.trim()}
              className="flex h-10 items-center gap-2 bg-ink px-4 text-xs font-bold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create board
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {boards.map((b) => {
          const selected = selectedBoardId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBoardId(b.id)}
              className={`flex items-center gap-2 border px-3 py-2 text-sm font-bold transition-colors active:scale-[0.97] ${
                selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ocean"
              }`}
            >
              {b.niche}
              {b.sub_niche && (
                <span className={`text-xs font-semibold ${selected ? "text-white/60" : "text-ocean"}`}>
                  {b.sub_niche}
                </span>
              )}
              <span
                className={`border-l pl-2 text-xs font-semibold ${
                  selected ? "border-white/20 text-white/70" : "border-line text-muted"
                }`}
              >
                {b.entry_count}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setShowCreate((v) => !v)}
          className={`flex h-9 items-center gap-1.5 border px-3 text-xs font-bold transition-colors active:scale-[0.97] ${
            showCreate ? "border-line bg-white text-muted" : "border-ocean bg-ocean text-white hover:bg-ocean/90"
          }`}
        >
          {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showCreate ? "Cancel" : "New board"}
        </button>
      </div>

      {loading && boards.length === 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading boards…
        </div>
      )}

      {!loading && boards.length === 0 && (
        <div className="mb-4 border border-dashed border-line bg-white p-6 text-center">
          <Trophy className="mx-auto h-7 w-7 text-muted/50" />
          <p className="mt-2 text-sm font-semibold">No boards yet</p>
          <p className="mt-1 text-xs text-muted">Create your first ranking board to get started.</p>
        </div>
      )}

      <div>
          {!selectedBoardId || !board ? (
            <div className="grid min-h-[320px] place-items-center border border-dashed border-line bg-white p-8 text-center">
              <div>
                <Trophy className="mx-auto h-8 w-8 text-muted/50" />
                <p className="mt-3 font-semibold">Select a board to edit its rankings</p>
                <p className="mt-1 text-sm text-muted">Choose a board from the list, or create a new one.</p>
              </div>
            </div>
          ) : (
            <div className="border border-line bg-white">
              <div className="border-b border-line p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                      <Trophy className="h-3.5 w-3.5 text-ocean" />
                      Topic leaderboard · Top {rankDepth}
                    </p>
                    <h3 className="mt-1.5 text-xl font-bold">
                      {board.niche}
                      {board.sub_niche && <span className="text-ocean"> / {board.sub_niche}</span>}
                    </h3>
                    <p className="mt-1 text-sm text-muted">Search the archive to assign the most notable accounts.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={handleDelete}
                      className="flex h-9 items-center gap-2 border border-coral/30 bg-white px-3 text-xs font-bold text-coral transition-colors hover:bg-coral/5 active:scale-[0.97]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`flex h-9 items-center gap-2 px-4 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97] ${
                        justSaved ? "bg-moss" : "bg-ink hover:bg-ocean"
                      }`}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : justSaved ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {saving ? "Saving…" : justSaved ? "Saved" : "Save ranking"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="thin-scrollbar flex flex-col gap-2 p-4 lg:max-h-[520px] lg:overflow-y-auto">
                {slots.map((slot) => {
                  const assigned = getInfluencerInSlot(slot.position);
                  return (
                    <div key={slot.position} className="flex items-center gap-2 border border-line bg-panel/30 p-2 sm:gap-3 sm:p-2.5">
                      <div className="flex w-12 shrink-0 justify-center">
                        <span
                          className={`grid h-8 w-8 place-items-center text-xs font-bold ${
                            slot.position <= 3 ? "bg-ink text-white" : "border border-line bg-white text-muted"
                          }`}
                        >
                          {slot.position}
                        </span>
                      </div>

                      <div ref={(el) => { searchRefs.current[slot.position] = el; }} className="relative min-w-0 flex-1">
                        {assigned ? (
                          <div className="flex items-center gap-2 border border-moss/40 bg-mint/40 px-2 py-1.5">
                            {assigned.profile_image_url ? (
                              <Image src={assigned.profile_image_url} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="grid h-7 w-7 shrink-0 place-items-center bg-ink text-[10px] font-bold text-white">
                                {assigned.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                                {assigned.name}
                                {assigned.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-ocean" />}
                              </p>
                              <p className="truncate text-xs text-muted">@{assigned.handle} · {formatFollowers(assigned.followers)}</p>
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => startReplace(slot.position)}
                                className="flex h-7 items-center gap-1 border border-line bg-white px-2 text-[11px] font-bold text-muted transition-colors hover:border-ocean hover:text-ocean active:scale-95"
                              >
                                <Search className="h-3 w-3" />
                                Replace
                              </button>
                              <button
                                onClick={() => clearSlot(slot.position)}
                                className="flex h-7 items-center gap-1 border border-line bg-white px-2 text-[11px] font-bold text-muted transition-colors hover:border-coral hover:text-coral active:scale-95"
                              >
                                <X className="h-3 w-3" />
                                Clear
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 border border-dashed border-line bg-white px-2 transition-colors focus-within:border-ocean">
                            <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <input
                              ref={(el) => { inputRefs.current[slot.position] = el; }}
                              value={searchQuery[slot.position] ?? ""}
                              onChange={(e) => {
                                setSearchQuery((prev) => ({ ...prev, [slot.position]: e.target.value }));
                                setOpenSearch((prev) => ({ ...prev, [slot.position]: true }));
                              }}
                              placeholder={`Search influencer to assign to Top ${slot.position}…`}
                              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
                            />
                          </div>
                        )}

                        {openSearch[slot.position] && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 border border-line bg-white shadow-lg">
                            <div className="max-h-[220px] overflow-y-auto">
                              {searchLoading[slot.position] && (
                                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Searching…
                                </div>
                              )}
                              {!searchLoading[slot.position] && !(searchQuery[slot.position] ?? "").trim() && (
                                <div className="px-3 py-4 text-center text-sm text-muted">Start typing to search the archive…</div>
                              )}
                              {!searchLoading[slot.position] && (searchQuery[slot.position] ?? "").trim() && (searchResults[slot.position] ?? []).length === 0 && (
                                <div className="px-3 py-4 text-center text-sm text-muted">No matches</div>
                              )}
                              {(searchResults[slot.position] ?? []).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => assignToSlot(slot.position, r)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-ocean/5"
                                >
                                  {r.profile_image_url ? (
                                    <Image src={r.profile_image_url} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                                  ) : (
                                    <div className="grid h-7 w-7 shrink-0 place-items-center bg-ink text-[10px] font-bold text-white">
                                      {r.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                                      {r.name}
                                      {r.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-ocean" />}
                                    </p>
                                    <p className="truncate text-xs text-muted">@{r.handle} · {formatFollowers(r.followers)}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {assigned && slots.find((x) => x.position === slot.position + 1)?.influencer !== null && slot.position < rankDepth && (
                        <button
                          onClick={() => swapSlots(slot.position, slot.position + 1)}
                          className="hidden h-7 w-7 shrink-0 items-center justify-center border border-line bg-white text-xs text-muted transition-colors hover:border-ocean hover:text-ocean sm:flex"
                          title="Swap with next"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
