"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { isToday, startOfWeek, endOfWeek, isWithinInterval, parseISO, compareAsc } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { applicationsApi, bannedCompaniesApi } from "@/lib/api";
import { FileViewerDialog } from "./file-viewer-dialog";
import type { Application } from "@/lib/types";
import {
  statusColors,
  statusLabels,
  workLocationLabels,
  type ApplicationStatus,
  type WorkLocation,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const allStatuses: ApplicationStatus[] = [
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

type SortField = "company" | "position" | "status" | "location" | "applied_at" | "source";
type SortDirection = "asc" | "desc";
type DateFilter = "all" | "today" | "this_week";

export function ApplicationsTable() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>("applied_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fileViewerApp, setFileViewerApp] = useState<Application | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["applications", { status: statusFilter, all: showDeleted }],
    queryFn: () =>
      applicationsApi.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        all: showDeleted,
      }),
  });

  const { data: bannedData } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  // Create a Set of banned company names for quick lookup (case-insensitive)
  const bannedNames = new Set(
    bannedData?.banned_companies.map((b) => b.name.trim().toLowerCase()) || []
  );

  const isCompanyBanned = (name: string) => bannedNames.has(name.trim().toLowerCase());

  const deleteMutation = useMutation({
    mutationFn: (id: number) => applicationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Application deleted");
    },
    onError: () => {
      toast.error("Failed to delete application");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => applicationsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Application restored");
    },
    onError: () => {
      toast.error("Failed to restore application");
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const isTodayCheck = (date: string) => {
    return isToday(parseISO(date));
  };

  const isThisWeek = (date: string) => {
    const checkDate = parseISO(date);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 }); // Saturday

    return isWithinInterval(checkDate, { start: weekStart, end: weekEnd });
  };

  const filteredAndSortedApps = (() => {
    const filtered =
      data?.applications.filter((app) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            (app.company_name || app.company_name_raw).toLowerCase().includes(query) ||
            app.position.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        // Date filter
        if (dateFilter === "today" && !isTodayCheck(app.applied_at)) {
          return false;
        }
        if (dateFilter === "this_week" && !isThisWeek(app.applied_at)) {
          return false;
        }

        return true;
      }) || [];

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "company":
          comparison = (a.company_name || a.company_name_raw).localeCompare(
            b.company_name || b.company_name_raw
          );
          break;
        case "position":
          comparison = a.position.localeCompare(b.position);
          break;
        case "status":
          comparison = (a.current_status || "").localeCompare(b.current_status || "");
          break;
        case "location":
          comparison = (a.work_location || "").localeCompare(b.work_location || "");
          break;
        case "applied_at":
          comparison = compareAsc(parseISO(a.applied_at), parseISO(b.applied_at));
          break;
        case "source":
          comparison = (a.source || "").localeCompare(b.source || "");
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search applications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {allStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="h-4 w-4"
          />
          Show deleted
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredAndSortedApps.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No applications found.</p>
          <Link
            href="/applications/new"
            className="text-primary hover:underline"
          >
            Add your first application
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("company")}
                >
                  <div className="flex items-center gap-2">
                    Company
                    {sortField === "company" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("position")}
                >
                  <div className="flex items-center gap-2">
                    Position
                    {sortField === "position" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortField === "status" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("location")}
                >
                  <div className="flex items-center gap-2">
                    Location
                    {sortField === "location" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("applied_at")}
                >
                  <div className="flex items-center gap-2">
                    Applied
                    {sortField === "applied_at" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("source")}
                >
                  <div className="flex items-center gap-2">
                    Source
                    {sortField === "source" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedApps.map((app) => (
                <TableRow
                  key={app.id}
                  className={cn(app.is_deleted && "opacity-50")}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/applications/${app.id}`}
                        className="hover:underline"
                      >
                        {app.company_name || app.company_name_raw}
                      </Link>
                      {app.file_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs cursor-pointer hover:bg-secondary/80"
                          onClick={() => setFileViewerApp(app)}
                        >
                          <ImageIcon className="h-3 w-3" />
                          {app.file_count}
                        </Badge>
                      )}
                      {isCompanyBanned(app.company_name || app.company_name_raw) && (
                        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3" />
                          Banned
                        </Badge>
                      )}
                      {app.is_deleted && (
                        <Badge variant="outline" className="text-xs">
                          Deleted
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{app.position}</TableCell>
                  <TableCell>
                    {app.current_status && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-white",
                          statusColors[app.current_status as ApplicationStatus]
                        )}
                      >
                        {statusLabels[app.current_status as ApplicationStatus]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {app.work_location
                      ? workLocationLabels[app.work_location as WorkLocation]
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(app.applied_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {app.source || "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/applications/${app.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {app.url && (
                          <DropdownMenuItem asChild>
                            <a
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Posting
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setFileViewerApp(app)}>
                          <ImageIcon className="mr-2 h-4 w-4" />
                          View Files
                          {app.file_count > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {app.file_count}
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {app.is_deleted ? (
                          <DropdownMenuItem
                            onClick={() => restoreMutation.mutate(app.id)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(app.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedApps.length} of {data?.total || 0} applications
      </div>

      {/* File viewer dialog */}
      {fileViewerApp && (
        <FileViewerDialog
          applicationId={fileViewerApp.id}
          companyName={fileViewerApp.company_name || fileViewerApp.company_name_raw}
          position={fileViewerApp.position}
          open={fileViewerApp !== null}
          onOpenChange={(open) => !open && setFileViewerApp(null)}
        />
      )}
    </div>
  );
}

