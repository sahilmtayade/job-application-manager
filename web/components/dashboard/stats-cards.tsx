"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Building2, TrendingUp, TrendingDown, CheckCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => statsApi.summary(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const activeCount = stats?.active || 0;
  const totalCount = stats?.total || 0;
  const offerCount = (stats?.by_status?.offer || 0) + (stats?.by_status?.accepted || 0);
  const successRate = totalCount > 0 ? ((offerCount / totalCount) * 100).toFixed(1) : "0";

  const todayCount = stats?.today || 0;
  const weekCount = stats?.this_week || 0;
  const lastWeekCount = stats?.last_week || 0;

  const calculateTrend = (current: number, previous: number) => {
    // Can't calculate meaningful percentage change from zero baseline
    if (previous === 0) return { change: 0, direction: "neutral" as const };
    const change = ((current - previous) / previous) * 100;
    return {
      change: Math.abs(Math.round(change)),
      direction: change > 0 ? "up" : change < 0 ? "down" : "neutral"
    } as const;
  };

  const weekTrend = calculateTrend(weekCount, lastWeekCount);
  const hasData = totalCount > 0;

  const cards = [
    {
      title: "Total Applications",
      value: totalCount,
      description: `${todayCount} today · ${weekCount} this week`,
      icon: FileText,
      trend: weekTrend,
      showTrend: true,
    },
    {
      title: "Active",
      value: activeCount,
      description: "Awaiting response",
      icon: TrendingUp,
      showTrend: false,
    },
    {
      title: "Companies",
      value: stats?.companies || 0,
      description: "Unique companies",
      icon: Building2,
      showTrend: false,
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      description: `${offerCount} offers received`,
      icon: CheckCircle,
      showTrend: false,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{card.value}</div>
              {hasData && card.showTrend && card.trend && card.trend.direction !== "neutral" && (
                <div
                  className={cn(
                    "flex items-center text-xs font-medium",
                    card.trend.direction === "up" ? "text-green-600" : "text-red-600"
                  )}
                >
                  {card.trend.direction === "up" ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {card.trend.change}% from last week
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

