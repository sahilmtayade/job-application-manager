"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api";
import { format, parseISO, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ActivityTrendProps {
  className?: string;
}

export function ActivityTrend({ className }: ActivityTrendProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "trends", "14d"],
    queryFn: () => statsApi.trends({ since: format(subDays(new Date(), 14), "yyyy-MM-dd"), group_by: "day" }),
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Fill in missing days with zero counts
  const fillMissingDays = (apiData: typeof data) => {
    if (!apiData?.data) return [];

    const dataMap = new Map(apiData.data.map(d => [d.date, d.count]));
    const filledData = [];

    for (let i = 13; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      filledData.push({
        date,
        count: dataMap.get(date) || 0
      });
    }

    return filledData;
  };

  const trendData = fillMissingDays(data);
  const maxCount = Math.max(...trendData.map((d) => d.count), 1);
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                Application Activity
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Last 14 days</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No application data yet
            </div>
          ) : (
            <div className="space-y-2">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-popover p-2 shadow-md">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-popover-foreground">
                                {payload[0].value} {payload[0].value === 1 ? 'application' : 'applications'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(payload[0].payload.date), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                    dot={(props) => {
                      const isToday = props.payload.date === today;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isToday ? 4 : 0}
                          fill="#3b82f6"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{
                      r: 5,
                      fill: "#3b82f6",
                      stroke: "hsl(var(--background))",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>{format(parseISO(trendData[0].date), "MMM d")}</span>
                <span className="font-medium text-primary">{maxCount} max</span>
                <span>{format(parseISO(trendData[trendData.length - 1].date), "MMM d")}</span>
              </div>
            </div>
          )}
        </CardContent>
    </Card>
  );
}

