"use client";

import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentApplications } from "@/components/dashboard/recent-applications";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import { ActivityTrend } from "@/components/dashboard/activity-trend";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { GamificationHero } from "@/components/dashboard/gamification-hero";
import { WeekComparison } from "@/components/dashboard/week-comparison";
import { AchievementWall } from "@/components/dashboard/achievement-wall";
import { useAchievementCelebration } from "@/hooks/use-achievement-celebration";

export default function DashboardPage() {
  // Enable celebration effects
  useAchievementCelebration();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" description="Your gamified job search journey" />
      <div className="flex-1 overflow-auto space-y-4 p-4 sm:space-y-6 sm:p-8">
        {/* Gamification Hero Section */}
        <GamificationHero />

        {/* Week vs Week Comparison */}
        <WeekComparison />

        {/* Stats Grid - Full width */}
        <StatsCards />

        {/* Main Content Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Left Column: Recent Activity */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <RecentApplications />
            <ActivityTrend />
            <UpcomingActions />
          </div>

          {/* Right Column: Achievements and Status */}
          <div className="space-y-4 sm:space-y-6">
            <AchievementWall />
            <StatusBreakdown />
          </div>
        </div>
      </div>
    </div>
  );
}
