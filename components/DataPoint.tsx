export function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white/70 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-ink">{value}</p>
    </div>
  );
}
