"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Clock, Trash2, Plus, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { applicationsApi } from "@/lib/api";
import { statusColors, statusLabels, type ApplicationStatus, type ApplicationEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

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

interface StatusHistoryProps {
  applicationId: number;
}

export function StatusHistory({ applicationId }: StatusHistoryProps) {
  const queryClient = useQueryClient();
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<ApplicationStatus | "">("");
  const [notes, setNotes] = useState("");
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<ApplicationEvent | null>(null);
  const [editStatus, setEditStatus] = useState<ApplicationStatus | "">("");
  const [editNotes, setEditNotes] = useState("");

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["applications", applicationId, "events"],
    queryFn: () => applicationsApi.getEvents(applicationId),
  });

  const { data: validStatusesData, isLoading: validStatusesLoading } = useQuery({
    queryKey: ["applications", applicationId, "valid-next-statuses"],
    queryFn: () => applicationsApi.getValidNextStatuses(applicationId),
  });

  const changeStatusMutation = useMutation({
    mutationFn: (data: { new_status: ApplicationStatus; notes?: string }) =>
      applicationsApi.changeStatus(applicationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "valid-next-statuses"] });
      toast.success("Status updated successfully");
      setShowAddStatus(false);
      setNewStatus("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: { to_status?: string; notes?: string } }) =>
      applicationsApi.updateEvent(applicationId, eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "valid-next-statuses"] });
      toast.success("Event updated successfully");
      setEditingEvent(null);
      setEditStatus("");
      setEditNotes("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update event: ${error.message}`);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) => applicationsApi.deleteEvent(applicationId, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "valid-next-statuses"] });
      toast.success("Event deleted successfully");
      setDeleteEventId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete event: ${error.message}`);
    },
  });

  const handleAddStatus = () => {
    if (!newStatus) {
      toast.error("Please select a status");
      return;
    }

    changeStatusMutation.mutate({
      new_status: newStatus as ApplicationStatus,
      notes: notes.trim() || undefined,
    });
  };

  const handleStartEdit = (event: ApplicationEvent) => {
    setEditingEvent(event);
    setEditStatus(event.to_status);
    setEditNotes(event.notes || "");
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditStatus("");
    setEditNotes("");
  };

  const handleSaveEdit = () => {
    if (!editingEvent || !editStatus) return;

    const hasStatusChange = editStatus !== editingEvent.to_status;
    const hasNotesChange = editNotes !== (editingEvent.notes || "");

    if (!hasStatusChange && !hasNotesChange) {
      setEditingEvent(null);
      return;
    }

    updateEventMutation.mutate({
      eventId: editingEvent.id,
      data: {
        to_status: hasStatusChange ? editStatus : undefined,
        notes: hasNotesChange ? editNotes : undefined,
      },
    });
  };

  // Get statuses that are available for editing (not already used by other events)
  const getAvailableStatusesForEdit = (currentEventId: number, currentStatus: ApplicationStatus) => {
    const usedStatuses = new Set(
      (eventsData?.events || [])
        .filter((e) => e.id !== currentEventId)
        .map((e) => e.to_status)
    );
    return allStatuses.filter((s) => s === currentStatus || !usedStatuses.has(s));
  };

  if (eventsLoading || validStatusesLoading) {
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

  const events = eventsData?.events || [];
  const validNextStatuses = validStatusesData?.valid_next_statuses || [];
  const currentStatus = validStatusesData?.current_status;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Status History</CardTitle>
              <CardDescription>Timeline of status changes</CardDescription>
            </div>
            {validNextStatuses.length > 0 && (
              <Button
                onClick={() => setShowAddStatus(!showAddStatus)}
                size="sm"
                variant={showAddStatus ? "outline" : "default"}
              >
                <Plus className="mr-2 h-4 w-4" />
                {showAddStatus ? "Cancel" : "Change Status"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddStatus && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ApplicationStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {validNextStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", statusColors[status])} />
                          {statusLabels[status]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this status change..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAddStatus}
                disabled={!newStatus || changeStatusMutation.isPending}
                className="w-full"
              >
                {changeStatusMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </div>
          )}

          {events.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No status events yet
            </p>
          ) : (
            <div className="space-y-3">
              {events
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((event, index) => {
                  const isLatest = index === 0;
                  const canDelete = events.length > 1;
                  const isEditing = editingEvent?.id === event.id;
                  const availableStatuses = getAvailableStatusesForEdit(event.id, event.to_status);

                  if (isEditing) {
                    return (
                      <div
                        key={event.id}
                        className="rounded-lg border border-primary p-4 space-y-3"
                      >
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Status</label>
                          <Select
                            value={editStatus}
                            onValueChange={(value) => setEditStatus(value as ApplicationStatus)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  <div className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", statusColors[status])} />
                                    {statusLabels[status]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Notes</label>
                          <Textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Add notes about this status change..."
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSaveEdit}
                            disabled={updateEventMutation.isPending}
                            size="sm"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {updateEventMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            variant="outline"
                            size="sm"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        isLatest && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {event.from_status && (
                            <>
                              <Badge
                                variant="secondary"
                                className={cn("text-white", statusColors[event.from_status])}
                              >
                                {statusLabels[event.from_status]}
                              </Badge>
                              <span className="text-sm text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge
                            variant="secondary"
                            className={cn("text-white", statusColors[event.to_status])}
                          >
                            {statusLabels[event.to_status]}
                          </Badge>
                          {isLatest && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(event.timestamp), "PPp")} (
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })})
                        </p>
                        {event.notes && (
                          <p className="text-sm mt-2 text-muted-foreground">{event.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(event)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteEventId(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {validNextStatuses.length === 0 && currentStatus && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Status is <strong>{statusLabels[currentStatus]}</strong> - no further transitions available
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteEventId !== null} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this status change event. This action cannot be undone.
              The application&apos;s current status will be recalculated from remaining events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventId && deleteEventMutation.mutate(deleteEventId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
