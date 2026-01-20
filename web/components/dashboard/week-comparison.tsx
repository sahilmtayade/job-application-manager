"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function WeekComparison() {
  const { data: comparison, isLoading } = useQuery({
    queryKey: ["stats", "weekly-comparison"],
    queryFn: () => statsApi.weeklyComparison(),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!comparison) return null;

  const thisWeek = comparison.this_week_apps;
  const lastWeek = comparison.last_week_apps;
  const change = comparison.apps_change_pct;
  const maxValue = Math.max(thisWeek, lastWeek) || 1;

  const getChangeIcon = (change: number) => {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return Minus;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600 dark:text-green-400";
    if (change < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const ChangeIcon = getChangeIcon(change);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">This Week vs Last Week</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{thisWeek}</span>
          {change !== 0 && (
            <div className={cn("flex items-center gap-1 text-sm", getChangeColor(change))}>
              <ChangeIcon className="h-4 w-4" />
              <span>{Math.abs(change).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 items-end">
        {/* This week bar */}
        <div className="flex-1 space-y-1">
          <div className="text-xs text-muted-foreground">This week</div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
              style={{ width: `${(thisWeek / maxValue) * 100}%` }}
            />
          </div>
          <div className="text-xs font-medium text-center">{thisWeek}</div>
        </div>
        {/* Last week bar */}
        <div className="flex-1 space-y-1">
          <div className="text-xs text-muted-foreground">Last week</div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-muted-foreground/30 transition-all"
              style={{ width: `${(lastWeek / maxValue) * 100}%` }}
            />
          </div>
          <div className="text-xs font-medium text-center">{lastWeek}</div>
        </div>
      </div>
    </div>
  );
}

