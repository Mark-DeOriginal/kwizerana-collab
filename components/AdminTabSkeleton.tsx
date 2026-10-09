type AdminTabSkeletonProps = {
  variant: "cards" | "list" | "rates" | "rankings";
  count?: number;
};

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-panel ${className}`} />;
}

/** A layout-preserving loading state for admin workspaces. */
export function AdminTabSkeleton({ variant, count = 3 }: AdminTabSkeletonProps) {
  if (variant === "rates") {
    return (
      <div className="overflow-hidden border border-line bg-white" aria-busy="true" aria-label="Loading currency rates">
        <div className="grid grid-cols-4 gap-4 border-b border-line bg-panel px-4 py-3">
          {Array.from({ length: 4 }, (_, index) => <Bar key={index} className="h-3 w-16" />)}
        </div>
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="grid grid-cols-4 items-center gap-4 border-b border-line px-4 py-3 last:border-0">
            <Bar className="h-4 w-12" /><Bar className="h-4 w-10" /><Bar className="h-9 w-28" /><Bar className="h-3 w-24" />
          </div>
        ))}
        <span className="sr-only">Loading currency rates.</span>
      </div>
    );
  }

  if (variant === "rankings") {
    return (
      <div aria-busy="true">
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => <Bar key={index} className="h-9 w-28" />)}
        </div>
        <div className="border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-5"><div className="space-y-2"><Bar className="h-3 w-24" /><Bar className="h-6 w-40" /></div><Bar className="h-9 w-28" /></div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-3 border border-line bg-panel/30 p-3"><Bar className="h-8 w-8" /><Bar className="h-10 flex-1" /></div>)}
          </div>
        </div>
        <span className="sr-only">Loading ranking boards.</span>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="border border-line bg-white p-5"><div className="flex gap-4"><Bar className="h-12 w-12 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-3"><Bar className="h-4 w-3/5" /><Bar className="h-3 w-2/5" /><Bar className="h-3 w-full" /></div></div><Bar className="mt-5 h-8 w-28" /></div>
        ))}
        <span className="sr-only">Loading dashboard records.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border border-line bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div className="min-w-0 flex-1 space-y-3"><Bar className="h-4 w-2/5" /><Bar className="h-3 w-3/5" /><Bar className="h-3 w-full" /></div><Bar className="h-9 w-32 shrink-0" /></div></div>
      ))}
      <span className="sr-only">Loading dashboard records.</span>
    </div>
  );
}
