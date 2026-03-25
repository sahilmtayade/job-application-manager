"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatSiteName } from "@/lib/constants/job-sources";
import { useJobSearch } from "@/lib/job-search-context";
import { CheckCircle2, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

function SearchTaskItem({
  task,
  currentTime,
}: {
  task: any;
  currentTime: number;
}) {
  const getDuration = () => {
    if (!task.startTime) return "Waiting...";
    const end = task.endTime || currentTime;
    const diff = end - task.startTime;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "searching":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-lg border text-sm transition-all duration-300 ${
        task.status === "searching"
          ? "bg-primary/5 border-primary/20 shadow-sm transform scale-[1.01]"
          : task.status === "completed"
            ? "bg-card border-border/50 opacity-75 hover:opacity-100"
            : task.status === "error"
              ? "bg-destructive/5 border-destructive/20"
              : "bg-muted/30 border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 truncate w-full">
        {getStatusIcon()}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">
              {task.keyword}
            </span>
            <span className="text-muted-foreground shrink-0">•</span>
            <span className="text-muted-foreground truncate">
              {task.location}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs py-0 h-4">
              {formatSiteName(task.site)}
            </Badge>
            {task.error && (
              <span className="text-xs text-destructive truncate">
                {task.error}
              </span>
            )}
            {task.status === "completed" && task.foundCount !== undefined && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Found {task.foundCount} jobs
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 text-muted-foreground tabular-nums min-w-[60px] justify-end">
        {getDuration()}
      </div>
    </div>
  );
}

export function JobSearchQueue() {
  const { searchTasks, isSearching } = useJobSearch();
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update timer for running tasks
  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearching]);

  if (!searchTasks || searchTasks.length === 0) {
    return null;
  }

  const inProgressCount = searchTasks.filter(
    (t: any) => t.status === "searching",
  ).length;
  const pendingCount = searchTasks.filter(
    (t: any) => t.status === "pending",
  ).length;
  const completedCount = searchTasks.filter(
    (t: any) => t.status === "completed",
  ).length;
  const errorCount = searchTasks.filter(
    (t: any) => t.status === "error",
  ).length;

  const sortedTasks = [...searchTasks].sort((a: any, b: any) => {
    // Order: searching, error, pending, completed
    const order = { searching: 0, error: 1, pending: 2, completed: 3 };
    if (
      order[a.status as keyof typeof order] !==
      order[b.status as keyof typeof order]
    ) {
      return (
        order[a.status as keyof typeof order] -
        order[b.status as keyof typeof order]
      );
    }
    // Sort completed tasks by most recently completed first
    if (a.status === "completed" && b.status === "completed") {
      return (b.endTime || 0) - (a.endTime || 0);
    }
    // If both are searching, sort by start time (oldest first)
    if (a.status === "searching" && b.status === "searching") {
      return (a.startTime || 0) - (b.startTime || 0);
    }
    return 0;
  });

  if (!isSearching) {
    if (searchTasks.length === 0) return null;
    return (
      <div className="flex justify-end mb-6 animate-in fade-in zoom-in duration-300">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/20 hover:bg-primary/5 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              View Search Results
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 font-normal"
              >
                {searchTasks.length} tasks
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mr-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Search Complete
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {completedCount > 0 && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {completedCount} complete
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-destructive font-medium">
                      {errorCount} errors
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="overflow-y-auto w-full flex-1">
              <div className="flex flex-col gap-1 p-3">
                {sortedTasks.map((task: any) => (
                  <SearchTaskItem
                    key={task.id}
                    task={task}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card className="mb-6 overflow-hidden border-primary/20 shadow-sm transition-all animate-in fade-in slide-in-from-top-4">
      <CardHeader className="bg-muted/30 pb-3 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            Search {isSearching ? "In Progress" : "Complete"}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-3">
              {inProgressCount > 0 && (
                <span className="text-primary font-medium">
                  {inProgressCount} active
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-muted-foreground">
                  {pendingCount} pending
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive font-medium">
                  {errorCount} errors
                </span>
              )}
              {completedCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {completedCount} complete
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {sortedTasks.length > 0 && (
        <CardContent className="p-0 animate-in slide-in-from-top-2">
          <div className="w-full border-t overflow-y-auto max-h-[400px]">
            <div className="flex flex-col gap-1 p-3">
              {sortedTasks.map((task: any) => (
                <SearchTaskItem
                  key={task.id}
                  task={task}
                  currentTime={currentTime}
                />
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
