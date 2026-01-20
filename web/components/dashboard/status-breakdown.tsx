"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api";
import { statusColors, statusLabels, type ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBreakdown() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => statsApi.summary(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const total = stats?.total || 1;
  const byStatus = stats?.by_status || {};

  const statusOrder: ApplicationStatus[] = [
    "applied",
    "screening",
    "interviewing",
    "offer",
    "accepted",
    "rejected",
    "withdrawn",
    "ghosted",
    "scam",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Breakdown</CardTitle>
        <CardDescription>Distribution of application statuses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusOrder.map((status) => {
          const count = byStatus[status] || 0;
          const percentage = ((count / total) * 100).toFixed(0);

          return (
            <div key={status} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{statusLabels[status]}</span>
                <span className="text-muted-foreground">
                  {count} ({percentage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full transition-all", statusColors[status])}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

