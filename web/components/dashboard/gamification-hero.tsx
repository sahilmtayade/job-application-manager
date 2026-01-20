"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi, goalsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function GamificationHero() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => statsApi.summary(),
  });

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["goals", "current"],
    queryFn: () => goalsApi.current(),
  });

  if (statsLoading || goalsLoading) {
    return (
      <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const currentStreak = stats?.current_streak || 0;
  const longestStreak = stats?.longest_streak || 0;
  const streakAtRisk = stats?.streak_at_risk || false;

  // Goals
  const dailyGoal = goals?.daily;
  const weeklyGoal = goals?.weekly;
  const dailyProgress = dailyGoal
    ? (dailyGoal.current / dailyGoal.target) * 100
    : 0;
  const weeklyProgress = weeklyGoal
    ? (weeklyGoal.current / weeklyGoal.target) * 100
    : 0;

  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      <div className="relative grid gap-6 md:grid-cols-2">
        {/* Streak Display */}
        <div className="flex flex-col items-center justify-center space-y-2 rounded-lg bg-white/50 dark:bg-black/20 p-6 backdrop-blur-sm">
          <Flame
            className={cn(
              "h-12 w-12 transition-all",
              currentStreak > 0
                ? "text-orange-500 fill-orange-500 animate-pulse"
                : "text-muted-foreground"
            )}
          />
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {currentStreak}
            </div>
            <p className="text-sm text-muted-foreground">
              day{currentStreak !== 1 ? "s" : ""} streak
            </p>
          </div>
          {streakAtRisk && (
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium text-center">
              Apply today to keep it alive!
            </p>
          )}
          {longestStreak > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Best: {longestStreak} day{longestStreak !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Goals Display */}
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg bg-white/50 dark:bg-black/20 p-6 backdrop-blur-sm">
          <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div className="w-full space-y-4">
            {/* Daily Goal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Daily Goal</span>
                {dailyGoal ? (
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    {dailyGoal.current} / {dailyGoal.target}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not set</span>
                )}
              </div>
              {dailyGoal && (
                <>
                  <Progress value={dailyProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {dailyGoal.remaining > 0
                      ? `${dailyGoal.remaining} more today`
                      : "Complete! 🎉"}
                  </p>
                </>
              )}
            </div>

            {/* Weekly Goal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Weekly Goal</span>
                {weeklyGoal ? (
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {weeklyGoal.current} / {weeklyGoal.target}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not set</span>
                )}
              </div>
              {weeklyGoal && (
                <>
                  <Progress value={weeklyProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {weeklyGoal.remaining > 0
                      ? `${weeklyGoal.remaining} more this week`
                      : "Complete! 🎉"}
                  </p>
                </>
              )}
            </div>

            {!dailyGoal && !weeklyGoal && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No goals set yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

