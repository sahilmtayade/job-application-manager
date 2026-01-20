"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { statsApi } from "@/lib/api";
import { fireAchievementConfetti, fireStreakConfetti, fireGoalConfetti } from "@/components/ui/confetti";
import { toast } from "sonner";

/**
 * Hook to detect and celebrate achievement unlocks, streak milestones, and goal completions
 */
export function useAchievementCelebration() {
  const previousStatsRef = useRef<{ total: number; current_streak: number } | null>(null);
  const previousAchievementsRef = useRef<Set<string>>(new Set());

  const { data: stats } = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => statsApi.summary(),
    refetchInterval: 30000, // Check every 30 seconds
  });

  const { data: achievementsList } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => statsApi.achievements(),
    refetchInterval: 30000,
  });

  const { data: goals } = useQuery({
    queryKey: ["goals", "current"],
    queryFn: async () => {
      try {
        const { goalsApi } = await import("@/lib/api");
        return goalsApi.current();
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!stats || !achievementsList) return;

    const currentTotal = stats.total;
    const currentStreak = stats.current_streak;
    const achievements = achievementsList.achievements;

    // Check for newly unlocked achievements
    const currentUnlockedIds = new Set(
      achievements.filter((a) => a.unlocked).map((a) => a.id)
    );

    currentUnlockedIds.forEach((id) => {
      if (!previousAchievementsRef.current.has(id)) {
        const achievement = achievements.find((a) => a.id === id);
        if (achievement) {
          fireAchievementConfetti();
          toast.success(`Achievement Unlocked: ${achievement.name}!`, {
            description: achievement.description,
            duration: 5000,
          });
        }
      }
    });

    previousAchievementsRef.current = currentUnlockedIds;

    // Check for new streak milestone
    const streakMilestones = [3, 7, 14, 30, 60];
    const previousStreak = previousStatsRef.current?.current_streak || 0;

    streakMilestones.forEach((milestone) => {
      if (currentStreak >= milestone && previousStreak < milestone) {
        fireStreakConfetti();
        toast.success(`${milestone}-Day Streak! 🔥`, {
          description: "You're on fire! Keep the momentum going!",
          duration: 5000,
        });
      }
    });

    previousStatsRef.current = {
      total: currentTotal,
      current_streak: currentStreak,
    };
  }, [stats, achievementsList]);

  // Check for weekly goal completion
  useEffect(() => {
    if (!goals?.weekly) return;

    const weeklyGoal = goals.weekly;
    if (weeklyGoal.current >= weeklyGoal.target && weeklyGoal.remaining === 0) {
      // Only fire once per goal period
      const goalKey = `weekly-${weeklyGoal.goal?.period_start}`;
      const celebratedKey = `celebrated-${goalKey}`;

      if (!sessionStorage.getItem(celebratedKey)) {
        fireGoalConfetti();
        toast.success("Weekly Goal Achieved! 🎯", {
          description: `You completed ${weeklyGoal.current} applications this week!`,
          duration: 5000,
        });
        sessionStorage.setItem(celebratedKey, "true");
      }
    }
  }, [goals]);
}

// Helper to fire standard confetti
function fireConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: any) {
    const confetti = require("canvas-confetti");
    confetti.default({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

