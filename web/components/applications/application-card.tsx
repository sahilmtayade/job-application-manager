"use client";

import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  MapPin,
  Calendar,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { applicationsApi } from "@/lib/api";
import {
  statusColors,
  statusLabels,
  workLocationLabels,
  type Application,
  type ApplicationStatus,
  type WorkLocation,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface ApplicationCardProps {
  application: Application;
  isBanned: boolean;
  isDragging?: boolean;
}

export function ApplicationCard({
  application,
  isBanned,
  isDragging = false,
}: ApplicationCardProps) {
  const queryClient = useQueryClient();

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

  return (
    <Card
      className={cn(
        "group cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg",
        application.is_deleted && "opacity-50"
      )}
    >
      <CardContent className="p-4 gap-3">
        {/* Header with company name and actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/applications/${application.id}`}
              className="font-semibold text-sm hover:underline truncate block"
              onClick={(e) => isDragging && e.preventDefault()}
            >
              {application.company_name || application.company_name_raw}
            </Link>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {application.position}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/applications/${application.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {application.url && (
                <DropdownMenuItem asChild>
                  <a
                    href={application.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Posting
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {application.is_deleted ? (
                <DropdownMenuItem
                  onClick={() => restoreMutation.mutate(application.id)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate(application.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges and indicators */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isBanned && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Banned
            </Badge>
          )}
          {application.is_deleted && (
            <Badge variant="outline" className="text-xs">
              Deleted
            </Badge>
          )}
          {application.work_location && (
            <Badge variant="secondary" className="text-xs">
              {workLocationLabels[application.work_location as WorkLocation]}
            </Badge>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(application.applied_at)}</span>
          </div>
          {application.location_address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{application.location_address}</span>
            </div>
          )}
          {application.source && (
            <div className="text-xs">
              <span className="font-medium">Source:</span> {application.source}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

