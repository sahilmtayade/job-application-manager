"use client";

import { Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GoalProgressCardProps {
  progress: GoalProgress | null;
  title: string;
  icon?: React.ReactNode;
}

export function GoalProgressCard({ progress, title, icon }: GoalProgressCardProps) {
  const current = progress?.current || 0;
  const target = progress?.target || 0;
  const percentage = progress?.percentage || 0;
  const hasGoal = progress?.goal !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon || <Target className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {!hasGoal ? (
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-muted-foreground">No goal set</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set a {title.toLowerCase()} goal to track progress
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{current}</span>
              <span className="text-muted-foreground">/ {target}</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span
                  className={cn(
                    "font-medium",
                    percentage >= 100
                      ? "text-green-500"
                      : percentage >= 75
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  )}
                >
                  {percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    percentage >= 100
                      ? "bg-green-500"
                      : percentage >= 75
                      ? "bg-yellow-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              {percentage >= 100 ? (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Goal achieved!
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {progress?.remaining || 0} more to reach goal
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

