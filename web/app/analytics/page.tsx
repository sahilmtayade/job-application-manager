"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Building2,
  Calendar,
  BarChart3,
  Activity,
  CalendarDays,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api";
import { statusLabels, type ApplicationStatus } from "@/lib/types";

export default function AnalyticsPage() {
  const { data: cumulative, isLoading: cumulativeLoading } = useQuery({
    queryKey: ["stats", "cumulative"],
    queryFn: () => statsApi.cumulative(),
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ["stats", "funnel"],
    queryFn: () => statsApi.funnel(),
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["stats", "sources"],
    queryFn: () => statsApi.sources(),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Analytics" description="Insights into your job search" />
      <div className="flex-1 overflow-auto space-y-6 p-8">
        {/* Cumulative Statistics Overview */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Overview Statistics</h2>
          {cumulativeLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : cumulative ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Applications */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.total_applications}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    All-time submissions
                  </p>
                </CardContent>
              </Card>

              {/* Average Per Day */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Per Day</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.avg_per_day}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Applications per active day
                  </p>
                </CardContent>
              </Card>

              {/* Average Per Week */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Per Week</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.avg_per_week}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Weekly average
                  </p>
                </CardContent>
              </Card>

              {/* Total Companies */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Companies</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.total_companies}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unique companies
                  </p>
                </CardContent>
              </Card>

              {/* Days Active */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Days Active</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.total_days_active}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Days with applications
                  </p>
                </CardContent>
              </Card>

              {/* Days Since Start */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Days Since Start</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.days_since_start}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const days = cumulative.days_since_start;
                      const weeks = Math.floor(days / 7);
                      const months = Math.floor(days / 30);

                      if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;
                      if (days < 30) return `${weeks} week${weeks !== 1 ? 's' : ''} (${days} days)`;
                      return `${months} month${months !== 1 ? 's' : ''} (${weeks} weeks)`;
                    })()}
                  </p>
                </CardContent>
              </Card>

              {/* Response Rate */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.response_rate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cumulative.total_responses} responses received
                  </p>
                </CardContent>
              </Card>

              {/* Most Active Day */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Most Active Day</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cumulative.most_active_day || "N/A"}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cumulative.busiest_month ? `Busiest: ${cumulative.busiest_month}` : "No data yet"}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          )}
        </div>

        {/* Existing Analytics */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Application Funnel</CardTitle>
              <CardDescription>Conversion through stages</CardDescription>
            </CardHeader>
            <CardContent>
              {funnelLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(funnel?.stages || {}).map(([stage, data]) => (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {statusLabels[stage as ApplicationStatus] || stage}
                        </span>
                        <span className="text-muted-foreground">
                          {data.count} ({data.rate.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(data.rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success by Source</CardTitle>
              <CardDescription>Which sources lead to offers</CardDescription>
            </CardHeader>
            <CardContent>
              {sourcesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : sources?.sources.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No source data yet
                </p>
              ) : (
                <div className="space-y-4">
                  {sources?.sources.map((source) => (
                    <div key={source.source} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{source.source}</span>
                        <span className="text-muted-foreground">
                          {source.success_count}/{source.total} (
                          {source.success_rate.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${source.success_rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

