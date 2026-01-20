"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { isToday, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { applicationsApi, bannedCompaniesApi } from "@/lib/api";
import { KanbanColumn } from "./kanban-column";
import { ApplicationCard } from "./application-card";
import {
  type Application,
  type ApplicationStatus,
  statusLabels,
} from "@/lib/types";

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

type DateFilter = "all" | "today" | "this_week";

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [validDropTargets, setValidDropTargets] = useState<Set<ApplicationStatus>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data, isLoading } = useQuery({
    queryKey: ["applications", { all: showDeleted }],
    queryFn: () => applicationsApi.list({ all: showDeleted }),
  });

  const { data: bannedData } = useQuery({
    queryKey: ["banned-companies"],
    queryFn: () => bannedCompaniesApi.list(),
  });

  const bannedNames = useMemo(
    () =>
      new Set(
        bannedData?.banned_companies.map((b) => b.name.trim().toLowerCase()) || []
      ),
    [bannedData]
  );

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ApplicationStatus }) =>
      applicationsApi.changeStatus(id, { new_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Status updated successfully");
    },
    onError: (error: any) => {
      const message = error.message || "Failed to update status";

      // Check if it's a validation error about invalid transitions
      if (message.includes("Invalid status transition")) {
        toast.error("Cannot move backward in the workflow", {
          description: "Applications can only progress forward or to terminal states (Rejected, Withdrawn, etc.)",
          duration: 5000,
        });
      } else {
        toast.error(message);
      }

      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const isTodayCheck = (date: string) => {
    return isToday(parseISO(date));
  };

  const isThisWeek = (date: string) => {
    const checkDate = parseISO(date);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });
    return isWithinInterval(checkDate, { start: weekStart, end: weekEnd });
  };

  const filteredApplications = useMemo(() => {
    return (
      data?.applications.filter((app) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            (app.company_name || app.company_name_raw)
              .toLowerCase()
              .includes(query) || app.position.toLowerCase().includes(query);
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
      }) || []
    );
  }, [data?.applications, searchQuery, dateFilter]);

  const applicationsByStatus = useMemo(() => {
    const grouped: Record<ApplicationStatus, Application[]> = {
      applied: [],
      screening: [],
      interviewing: [],
      offer: [],
      accepted: [],
      rejected: [],
      withdrawn: [],
      ghosted: [],
      scam: [],
    };

    filteredApplications.forEach((app) => {
      if (app.current_status) {
        grouped[app.current_status as ApplicationStatus].push(app);
      }
    });

    return grouped;
  }, [filteredApplications]);

  const handleDragStart = async (event: DragStartEvent) => {
    const { active } = event;
    const appId = active.id as number;
    setActiveId(appId);

    // Fetch valid next statuses for this application
    try {
      const validStatuses = await applicationsApi.getValidNextStatuses(appId);
      setValidDropTargets(new Set(validStatuses.valid_next_statuses));
    } catch (error) {
      console.error("Failed to fetch valid statuses:", error);
      setValidDropTargets(new Set());
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setValidDropTargets(new Set());

    if (!over) return;

    const activeApp = filteredApplications.find(
      (app) => app.id === active.id
    );
    if (!activeApp) return;

    const newStatus = over.id as ApplicationStatus;
    const oldStatus = activeApp.current_status;

    // Only update if status changed
    if (newStatus !== oldStatus) {
      // Check if this is a valid transition
      if (validDropTargets.size > 0 && !validDropTargets.has(newStatus)) {
        toast.error("Invalid transition", {
          description: "Applications can only progress forward or to terminal states",
          duration: 4000,
        });
        return;
      }

      // Optimistic update
      queryClient.setQueryData(
        ["applications", { all: showDeleted }],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.map((app: Application) =>
              app.id === activeApp.id
                ? { ...app, current_status: newStatus }
                : app
            ),
          };
        }
      );

      changeStatusMutation.mutate({
        id: activeApp.id,
        status: newStatus,
      });
    }
  };

  const activeApplication = activeId
    ? filteredApplications.find((app) => app.id === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 flex-wrap px-8 pt-8 pb-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8">
          <div className="flex gap-4 pb-4 h-full">
            {allStatuses.map((status) => (
              <Skeleton key={status} className="h-full w-[320px] shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap px-8 pt-8 pb-4">
        <Input
          placeholder="Search applications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={dateFilter}
          onValueChange={(value: DateFilter) => setDateFilter(value)}
        >
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

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8">
          <div className="flex gap-4 pb-4 h-full">
            {allStatuses.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                applications={applicationsByStatus[status]}
                bannedCompanyNames={bannedNames}
                isValidDropTarget={validDropTargets.size === 0 || validDropTargets.has(status)}
                isDragging={activeId !== null}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeApplication ? (
            <div className="rotate-3 scale-105">
              <ApplicationCard
                application={activeApplication}
                isBanned={bannedNames.has(
                  (
                    activeApplication.company_name ||
                    activeApplication.company_name_raw
                  ).trim().toLowerCase()
                )}
                isDragging={true}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Summary */}
      <div className="text-sm text-muted-foreground px-8 pb-8 pt-4">
        Showing {filteredApplications.length} of {data?.total || 0}{" "}
        applications
      </div>
    </div>
  );
}

