"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Rocket,
  Star,
  Zap,
  Trophy,
  Crown,
  Flame,
  Medal,
  Target,
  MessageCircle,
  UserCheck,
  Gift,
  Building2,
  Layers,
  Sunrise,
  Moon,
  Calendar,
  TrendingUp,
  BarChart,
  MessageSquare,
  CheckCircle,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { statsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/types";

const achievementIcons: Record<string, React.ElementType> = {
  Rocket,
  Star,
  Zap,
  Trophy,
  Crown,
  Flame,
  Fire: Flame,  // Map Fire to Flame as lucide-react doesn't have Fire
  Medal,
  Target,
  MessageCircle,
  UserCheck,
  Gift,
  Building2: Building2,
  Building: Building2,
  Layers,
  Sunrise,
  Moon,
  Calendar,
  TrendingUp,
  BarChart,
  MessageSquare,
  CheckCircle,
  Award,
  Run: Target,
};

const categoryColors: Record<string, string> = {
  applications: "text-blue-500",
  streaks: "text-orange-500",
  progress: "text-green-500",
  time_based: "text-purple-500",
  combo: "text-pink-500",
  daily: "text-cyan-500",
  weekly: "text-amber-500",
  monthly: "text-emerald-500",
};

export function AchievementWall() {
  const { data: achievementsList, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => statsApi.achievements(),
  });

  const [selectedTab, setSelectedTab] = useState<string>("all");

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const achievements = achievementsList?.achievements || [];

  // Filter achievements by tab
  const filterAchievements = (tab: string): Achievement[] => {
    if (tab === "all") return achievements;
    if (tab === "daily") {
      return achievements.filter(
        (a) => a.reset_period === "daily" || a.category === "daily"
      );
    }
    if (tab === "weekly") {
      return achievements.filter(
        (a) => a.reset_period === "weekly" || a.category === "weekly"
      );
    }
    if (tab === "monthly") {
      return achievements.filter(
        (a) => a.reset_period === "monthly" || a.category === "monthly"
      );
    }
    return achievements;
  };

  const filteredAchievements = filterAchievements(selectedTab);
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    // Recently unlocked first
    if (a.unlocked === b.unlocked) {
      // Among unlocked/locked, sort by progress percentage
      const aProgress = (a.progress / a.threshold) * 100;
      const bProgress = (b.progress / b.threshold) * 100;
      return bProgress - aProgress;
    }
    return a.unlocked ? -1 : 1;
  });

  const unlockedCount = filteredAchievements.filter((a) => a.unlocked).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Achievements</CardTitle>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {unlockedCount}/{filteredAchievements.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4">
            {sortedAchievements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No achievements in this category yet.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                {sortedAchievements.map((achievement) => {
                  const Icon = achievementIcons[achievement.icon] || Award;
                  const progressPercentage = achievement.threshold > 0
                    ? (achievement.progress / achievement.threshold) * 100
                    : 0;

                  return (
                    <TooltipProvider key={achievement.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "relative flex aspect-square items-center justify-center rounded-lg border p-2 transition-all hover:scale-105",
                              achievement.unlocked
                                ? "bg-gradient-to-br from-yellow-100 to-yellow-50 border-yellow-300 dark:from-yellow-900/30 dark:to-yellow-800/20 dark:border-yellow-700/50 shadow-md"
                                : "bg-muted/50 border-muted-foreground/20 grayscale opacity-60"
                            )}
                          >
                            {Icon && (
                              <Icon
                                className={cn(
                                  "h-6 w-6",
                                  achievement.unlocked
                                    ? categoryColors[achievement.category] || "text-yellow-600"
                                    : "text-muted-foreground/50"
                                )}
                              />
                            )}
                            {!achievement.unlocked && (
                              <Lock className="absolute bottom-1 right-1 h-3 w-3 text-muted-foreground/50" />
                            )}
                            {achievement.unlocked && (
                              <div className="absolute inset-0 animate-pulse rounded-lg bg-yellow-400/10 pointer-events-none" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-2">
                            <p className="font-medium">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {achievement.description}
                            </p>
                            {!achievement.unlocked && achievement.threshold > 0 && (
                              <div className="space-y-1">
                                <Progress value={progressPercentage} className="h-1.5" />
                                <p className="text-xs text-muted-foreground">
                                  {achievement.progress} / {achievement.threshold}
                                </p>
                              </div>
                            )}
                            {achievement.reset_period && (
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                Resets {achievement.reset_period}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

