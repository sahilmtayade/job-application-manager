"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { ApplicationCard } from "./application-card";
import {
  statusColors,
  statusLabels,
  type Application,
  type ApplicationStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: ApplicationStatus;
  applications: Application[];
  bannedCompanyNames: Set<string>;
  isValidDropTarget?: boolean;
  isDragging?: boolean;
}

interface DraggableApplicationCardProps {
  application: Application;
  isBanned: boolean;
}

function DraggableApplicationCard({
  application,
  isBanned,
}: DraggableApplicationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: application.id,
    data: {
      type: "application",
      application,
    },
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <ApplicationCard
        application={application}
        isBanned={isBanned}
        isDragging={isDragging}
      />
    </div>
  );
}

export function KanbanColumn({
  status,
  applications,
  bannedCompanyNames,
  isValidDropTarget = true,
  isDragging = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: "column",
      status,
    },
  });

  const isCompanyBanned = (name: string) =>
    bannedCompanyNames.has(name.trim().toLowerCase());

  return (
    <div className="flex flex-col h-full min-w-[320px] w-[320px] flex-shrink-0">
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-t-lg border-b transition-opacity",
          statusColors[status],
          "text-white",
          isDragging && !isValidDropTarget && "opacity-40"
        )}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">
            {statusLabels[status]}
          </h3>
          <Badge
            variant="secondary"
            className="bg-white/20 text-white border-white/30"
          >
            {applications.length}
          </Badge>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20 rounded-b-lg border border-t-0 transition-all",
          isOver && isValidDropTarget && "bg-muted/40 ring-2 ring-primary/50",
          isOver && !isValidDropTarget && "bg-destructive/10 ring-2 ring-destructive/50",
          isDragging && !isValidDropTarget && "opacity-40"
        )}
      >
        {applications.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground text-center p-4">
            No applications in this status
          </div>
        ) : (
          applications.map((app) => (
            <DraggableApplicationCard
              key={app.id}
              application={app}
              isBanned={isCompanyBanned(
                app.company_name || app.company_name_raw
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}

