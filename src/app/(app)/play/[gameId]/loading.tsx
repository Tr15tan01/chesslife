import { Skeleton } from '@/components/ui/misc'

export default function Loading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading negotiation">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr_300px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}
