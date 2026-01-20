"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { goalsApi } from "@/lib/api";
import type { GoalType } from "@/lib/types";

interface SetGoalDialogProps {
  trigger?: React.ReactNode;
  defaultType?: GoalType;
}

export function SetGoalDialog({ trigger, defaultType }: SetGoalDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>(defaultType || "daily");
  const [targetCount, setTargetCount] = useState("");

  const createMutation = useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success(`${goalType === "daily" ? "Daily" : "Weekly"} goal set!`);
      setOpen(false);
      setTargetCount("");
    },
    onError: (error) => {
      toast.error(`Failed to set goal: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(targetCount);
    if (isNaN(count) || count <= 0) {
      toast.error("Please enter a valid target count");
      return;
    }
    createMutation.mutate({ goal_type: goalType, target_count: count });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Set Goal</Button>}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set Application Goal</DialogTitle>
            <DialogDescription>
              Set a daily or weekly target for job applications
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Goal Type</label>
              <Select
                value={goalType}
                onValueChange={(v: GoalType) => setGoalType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Applications</label>
              <Input
                type="number"
                min="1"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                placeholder={goalType === "daily" ? "e.g., 5" : "e.g., 25"}
              />
              <p className="text-xs text-muted-foreground">
                {goalType === "daily"
                  ? "Number of applications to submit per day"
                  : "Number of applications to submit per week"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Setting..." : "Set Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

