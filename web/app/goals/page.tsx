"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Calendar, Plus, Target } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { GoalProgressCard } from "@/components/goals/goal-progress-card";
import { SetGoalDialog } from "@/components/goals/set-goal-dialog";
import { goalsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function GoalsPage() {
  const { data: currentGoals, isLoading: currentLoading } = useQuery({
    queryKey: ["goals", "current"],
    queryFn: () => goalsApi.current(),
  });

  const { data: allGoals, isLoading: historyLoading } = useQuery({
    queryKey: ["goals", "list"],
    queryFn: () => goalsApi.list(),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Goals" description="Track your application targets" />
      <div className="flex-1 overflow-auto space-y-6 p-8">
        {/* Current Goals */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current Goals</h2>
          <SetGoalDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Set Goal
              </Button>
            }
          />
        </div>

        {currentLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <GoalProgressCard
              progress={currentGoals?.daily || null}
              title="Daily Goal"
              icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            />
            <GoalProgressCard
              progress={currentGoals?.weekly || null}
              title="Weekly Goal"
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <SetGoalDialog
            defaultType="daily"
            trigger={
              <Button variant="outline" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Update Daily Goal
              </Button>
            }
          />
          <SetGoalDialog
            defaultType="weekly"
            trigger={
              <Button variant="outline" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Update Weekly Goal
              </Button>
            }
          />
        </div>

        {/* Goal History */}
        <Card>
          <CardHeader>
            <CardTitle>Goal History</CardTitle>
            <CardDescription>Your past application goals</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !allGoals?.goals.length ? (
              <p className="py-8 text-center text-muted-foreground">
                No goals set yet. Start tracking your progress!
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allGoals.goals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium capitalize">
                        {goal.goal_type}
                      </TableCell>
                      <TableCell>{goal.target_count} applications</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(goal.period_start)} -{" "}
                        {formatDate(goal.period_end)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {goal.created_at
                          ? format(parseISO(goal.created_at), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

