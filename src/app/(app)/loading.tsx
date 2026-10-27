import { Skeleton } from '@/components/ui/misc'

export default function Loading() {
  return (
    <div className="space-y-6 px-4 py-8 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
