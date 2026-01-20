"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Clock, MessageSquare, Briefcase, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { applicationsApi } from "@/lib/api";
import { statusColors, statusLabels, type ApplicationStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";

export function UpcomingActions() {
  const { data, isLoading } = useQuery({
    queryKey: ["applications", "all"],
    queryFn: () => applicationsApi.list({}),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const applications = data?.applications || [];

  // Find applications needing attention
  const needsAttention = applications
    .filter((app) => {
      const statusDate = app.status_updated_at || app.applied_at;
      const daysSinceStatusChange = differenceInDays(new Date(), parseISO(statusDate));

      // Applications in "applied" status for more than 7 days
      if (app.current_status === "applied" && daysSinceStatusChange > 7) return true;

      // Applications in interviewing status
      if (app.current_status === "interviewing") return true;

      // Applications in screening status for more than 3 days
      if (app.current_status === "screening" && daysSinceStatusChange > 3) return true;

      return false;
    })
    .slice(0, 5);

  const getActionIcon = (status: string, daysSinceStatusChange: number) => {
    if (status === "interviewing") return <Briefcase className="h-4 w-4" />;
    if (status === "screening") return <MessageSquare className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getActionMessage = (status: string, daysSinceStatusChange: number) => {
    if (status === "interviewing") return "Interview in progress";
    if (status === "screening") return `In screening for ${daysSinceStatusChange} ${daysSinceStatusChange === 1 ? 'day' : 'days'}`;
    return `No response for ${daysSinceStatusChange} ${daysSinceStatusChange === 1 ? 'day' : 'days'}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          Needs Attention
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">Applications requiring follow-up</CardDescription>
      </CardHeader>
      <CardContent>
        {needsAttention.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No applications need immediate attention
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {needsAttention.map((app) => {
              const statusDate = app.status_updated_at || app.applied_at;
              const daysSinceStatusChange = differenceInDays(new Date(), parseISO(statusDate));

              return (
                <Link
                  key={app.id}
                  href={`/applications/${app.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {app.company_name || app.company_name_raw}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-white text-xs flex-shrink-0",
                            app.current_status && statusColors[app.current_status as ApplicationStatus]
                          )}
                        >
                          {app.current_status && statusLabels[app.current_status as ApplicationStatus]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {app.position}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        {app.current_status && getActionIcon(app.current_status, daysSinceStatusChange)}
                        <span className="truncate">{app.current_status && getActionMessage(app.current_status, daysSinceStatusChange)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

