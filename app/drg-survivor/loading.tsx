import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          <div className="text-center space-y-2 py-8">
            <Skeleton className="h-10 w-96 mx-auto" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </div>

          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </main>
  )
}
