const bar = "bg-muted rounded-control animate-pulse motion-reduce:animate-none";

export function ProductCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-panel overflow-hidden border" aria-hidden="true">
      <div className={`${bar} aspect-square rounded-none`} />
      <div className="flex flex-col gap-2 p-3">
        <div className={`${bar} h-3 w-1/3`} />
        <div className={`${bar} h-4 w-full`} />
        <div className={`${bar} h-4 w-2/3`} />
        <div className={`${bar} mt-2 h-6 w-1/2`} />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="min-w-0">
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
