"""Service layer for achievements/badges system"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from jam.db.connection import get_cursor


@dataclass
class Achievement:
    """Represents an achievement definition"""
    id: str
    name: str
    description: str
    icon: str
    category: str  # "applications", "streaks", "progress", "time_based", "combo", "daily", "weekly", "monthly"
    threshold: int  # Value needed to unlock
    reset_period: Optional[str] = None  # "daily", "weekly", "monthly" for recurring achievements
    unlocked: bool = False
    unlocked_at: Optional[datetime] = None
    progress: int = 0  # Current progress toward threshold


# Achievement definitions
ACHIEVEMENTS = [
    # Application count achievements (All-time milestones)
    Achievement(
        id="first_blood",
        name="First Blood",
        description="Submit your first job application",
        icon="Rocket",
        category="applications",
        threshold=1,
    ),
    Achievement(
        id="getting_started",
        name="Getting Started",
        description="Submit 5 job applications",
        icon="Star",
        category="applications",
        threshold=5,
    ),
    Achievement(
        id="double_digits",
        name="Double Digits",
        description="Submit 10 job applications",
        icon="Zap",
        category="applications",
        threshold=10,
    ),
    Achievement(
        id="persistent",
        name="Persistent",
        description="Submit 25 job applications",
        icon="Trophy",
        category="applications",
        threshold=25,
    ),
    Achievement(
        id="half_century",
        name="Half Century",
        description="Submit 50 job applications",
        icon="Award",
        category="applications",
        threshold=50,
    ),
    Achievement(
        id="century",
        name="Century Club",
        description="Submit 100 job applications",
        icon="Crown",
        category="applications",
        threshold=100,
    ),
    Achievement(
        id="two_fifty",
        name="Power User",
        description="Submit 250 job applications",
        icon="Zap",
        category="applications",
        threshold=250,
    ),
    Achievement(
        id="five_hundred",
        name="Unstoppable Force",
        description="Submit 500 job applications",
        icon="Crown",
        category="applications",
        threshold=500,
    ),

    # Streak achievements
    Achievement(
        id="on_fire",
        name="On Fire",
        description="Maintain a 3-day application streak",
        icon="Flame",
        category="streaks",
        threshold=3,
    ),
    Achievement(
        id="dedicated",
        name="Dedicated",
        description="Maintain a 7-day application streak",
        icon="Fire",
        category="streaks",
        threshold=7,
    ),
    Achievement(
        id="unstoppable",
        name="Unstoppable",
        description="Maintain a 14-day application streak",
        icon="Medal",
        category="streaks",
        threshold=14,
    ),
    Achievement(
        id="marathon",
        name="Marathon Runner",
        description="Maintain a 30-day application streak",
        icon="Target",
        category="streaks",
        threshold=30,
    ),
    Achievement(
        id="streak_master",
        name="Streak Master",
        description="Maintain a 60-day application streak",
        icon="Crown",
        category="streaks",
        threshold=60,
    ),

    # Progress achievements
    Achievement(
        id="first_response",
        name="First Response",
        description="Get your first screening callback",
        icon="MessageCircle",
        category="progress",
        threshold=1,
    ),
    Achievement(
        id="interview_ready",
        name="Interview Ready",
        description="Land your first interview",
        icon="UserCheck",
        category="progress",
        threshold=1,
    ),
    Achievement(
        id="offer_received",
        name="Offer Received",
        description="Receive your first job offer",
        icon="Gift",
        category="progress",
        threshold=1,
    ),
    Achievement(
        id="diversified",
        name="Diversified",
        description="Apply to 10 different companies",
        icon="Building",
        category="progress",
        threshold=10,
    ),
    Achievement(
        id="multi_tracker",
        name="Multi-Tracker",
        description="Have 5 applications in active status at once",
        icon="Layers",
        category="progress",
        threshold=5,
    ),
    Achievement(
        id="multiple_offers",
        name="In Demand",
        description="Have 2 or more active offers",
        icon="Trophy",
        category="progress",
        threshold=2,
    ),

    # Time-based achievements (Daily/Weekly resets)
    Achievement(
        id="weekend_warrior",
        name="Weekend Warrior",
        description="Apply on Saturday or Sunday",
        icon="Calendar",
        category="time_based",
        reset_period="weekly",
        threshold=1,
    ),

    # Combo achievements (Daily)
    Achievement(
        id="power_hour",
        name="Power Hour",
        description="Submit 3 applications in one day",
        icon="Zap",
        category="combo",
        reset_period="daily",
        threshold=3,
    ),
    Achievement(
        id="blitz_day",
        name="Blitz Day",
        description="Submit 5 applications in one day",
        icon="Rocket",
        category="combo",
        reset_period="daily",
        threshold=5,
    ),
    Achievement(
        id="super_blitz",
        name="Super Blitz",
        description="Submit 10 applications in one day",
        icon="Crown",
        category="combo",
        reset_period="daily",
        threshold=10,
    ),

    # Weekly combo achievements
    Achievement(
        id="sprint_week",
        name="Sprint Week",
        description="Submit 10 applications this week",
        icon="TrendingUp",
        category="combo",
        reset_period="weekly",
        threshold=10,
    ),
    Achievement(
        id="productive_week",
        name="Productive Week",
        description="Submit 20 applications this week",
        icon="BarChart",
        category="combo",
        reset_period="weekly",
        threshold=20,
    ),
    Achievement(
        id="interview_week",
        name="Interview Week",
        description="Have 3 interviews scheduled this week",
        icon="Calendar",
        category="combo",
        reset_period="weekly",
        threshold=3,
    ),
    Achievement(
        id="response_rush",
        name="Response Rush",
        description="Get 3 responses this week",
        icon="MessageSquare",
        category="combo",
        reset_period="weekly",
        threshold=3,
    ),

    # Volume milestones (Cumulative)
    Achievement(
        id="daily_habit",
        name="Daily Habit",
        description="Apply on 7 different days (cumulative)",
        icon="CheckCircle",
        category="daily",
        threshold=7,
    ),
    Achievement(
        id="consistent_applier",
        name="Consistent Applier",
        description="Apply on 30 different days (cumulative)",
        icon="Calendar",
        category="daily",
        threshold=30,
    ),
    Achievement(
        id="veteran",
        name="Veteran",
        description="Apply on 100 different days (cumulative)",
        icon="Award",
        category="daily",
        threshold=100,
    ),

    # Monthly achievements (Reset monthly)
    Achievement(
        id="monthly_champion",
        name="Monthly Champion",
        description="Submit 30+ applications this month",
        icon="Trophy",
        category="monthly",
        reset_period="monthly",
        threshold=30,
    ),
    Achievement(
        id="monthly_beast",
        name="Monthly Beast",
        description="Submit 50+ applications this month",
        icon="Crown",
        category="monthly",
        reset_period="monthly",
        threshold=50,
    ),
    Achievement(
        id="monthly_legend",
        name="Monthly Legend",
        description="Submit 100+ applications this month",
        icon="Star",
        category="monthly",
        reset_period="monthly",
        threshold=100,
    ),

    # Advanced progress achievements
    Achievement(
        id="fast_track",
        name="Fast Track",
        description="Get an offer within 2 weeks of applying",
        icon="Zap",
        category="progress",
        threshold=1,
    ),
    Achievement(
        id="persistent_hunter",
        name="Persistent Hunter",
        description="Keep applying after 10+ rejections",
        icon="Target",
        category="progress",
        threshold=10,
    ),
]


class AchievementService:
    """Business logic for achievements"""

    def get_achievements(self) -> list[dict]:
        """
        Get all achievements with their current unlock status and progress.
        """
        with get_cursor() as (conn, cursor):
            # Get total application count
            cursor.execute(
                "SELECT COUNT(*) as count FROM applications WHERE is_deleted = 0"
            )
            total_apps = cursor.fetchone()["count"]

            # Get unique companies count
            cursor.execute(
                "SELECT COUNT(DISTINCT company_id) as count FROM applications WHERE is_deleted = 0"
            )
            unique_companies = cursor.fetchone()["count"]

            # Get longest streak (calculated from application dates)
            longest_streak = self._calculate_longest_streak(cursor)

            # Get status counts
            cursor.execute(
                """
                SELECT e.to_status as status, COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE a.is_deleted = 0
                GROUP BY e.to_status
                """
            )
            status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}

            screening_count = status_counts.get("screening", 0)
            interview_count = status_counts.get("interviewing", 0)
            offer_count = status_counts.get("offer", 0) + status_counts.get("accepted", 0)

            # Get active applications count
            cursor.execute(
                """
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                WHERE a.is_deleted = 0
                AND e.to_status IN ('applied', 'screening', 'interviewing', 'offer')
                """
            )
            active_count = cursor.fetchone()["count"]

            # Get active offers count
            cursor.execute(
                """
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                WHERE a.is_deleted = 0
                AND e.to_status = 'offer'
                """
            )
            active_offers = cursor.fetchone()["count"]

            # Get rejection count
            cursor.execute(
                """
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE a.is_deleted = 0
                AND e.to_status = 'rejected'
                """
            )
            rejection_count = cursor.fetchone()["count"]

            # Time-based achievements
            this_week_weekend = self._check_weekend_warrior(cursor)

            # Combo achievements
            today_apps = self._get_today_apps_count(cursor)
            this_week_apps = self._get_this_week_apps_count(cursor)
            this_week_interviews = self._get_this_week_interviews(cursor)
            this_week_responses = self._get_this_week_responses(cursor)
            this_month_apps = self._get_this_month_apps_count(cursor)

            # Cumulative unique days
            unique_days = self._get_unique_application_days(cursor)

            # Advanced progress
            fast_track_count = self._check_fast_track(cursor)

            # Build achievement list with status
            achievements = []
            for ach in ACHIEVEMENTS:
                progress = 0

                # Determine progress based on category
                if ach.category == "applications":
                    progress = total_apps
                elif ach.category == "streaks":
                    progress = longest_streak
                elif ach.category == "progress":
                    if ach.id == "first_response":
                        progress = screening_count
                    elif ach.id == "interview_ready":
                        progress = interview_count
                    elif ach.id == "offer_received":
                        progress = offer_count
                    elif ach.id == "diversified":
                        progress = unique_companies
                    elif ach.id == "multi_tracker":
                        progress = active_count
                    elif ach.id == "multiple_offers":
                        progress = active_offers
                    elif ach.id == "fast_track":
                        progress = fast_track_count
                    elif ach.id == "persistent_hunter":
                        progress = rejection_count
                    else:
                        progress = 0
                elif ach.category == "time_based":
                    if ach.id == "weekend_warrior":
                        progress = 1 if this_week_weekend else 0
                elif ach.category == "combo":
                    if ach.reset_period == "daily":
                        if ach.id in ["power_hour", "blitz_day", "super_blitz"]:
                            progress = today_apps
                    elif ach.reset_period == "weekly":
                        if ach.id in ["sprint_week", "productive_week"]:
                            progress = this_week_apps
                        elif ach.id == "interview_week":
                            progress = this_week_interviews
                        elif ach.id == "response_rush":
                            progress = this_week_responses
                elif ach.category == "daily":
                    progress = unique_days
                elif ach.category == "monthly":
                    progress = this_month_apps

                unlocked = progress >= ach.threshold

                achievements.append({
                    "id": ach.id,
                    "name": ach.name,
                    "description": ach.description,
                    "icon": ach.icon,
                    "category": ach.category,
                    "threshold": ach.threshold,
                    "progress": min(progress, ach.threshold),  # Cap at threshold
                    "unlocked": unlocked,
                    "reset_period": ach.reset_period,
                })

            return achievements

    def _calculate_longest_streak(self, cursor) -> int:
        """Calculate the longest application streak"""
        cursor.execute(
            """
            SELECT DISTINCT date(applied_at) as app_date
            FROM applications
            WHERE is_deleted = 0
            ORDER BY app_date
            """
        )

        dates = [row["app_date"] for row in cursor.fetchall()]
        if not dates:
            return 0

        # Convert to date objects
        app_dates = []
        for d in dates:
            if isinstance(d, str):
                app_dates.append(date.fromisoformat(d))
            else:
                app_dates.append(d)

        app_dates.sort()

        longest = 1
        current = 1

        for i in range(1, len(app_dates)):
            if (app_dates[i] - app_dates[i - 1]).days == 1:
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        return longest

    def _check_weekend_warrior(self, cursor) -> bool:
        """Check if any application was submitted on Saturday or Sunday this week"""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        cursor.execute(
            """
            SELECT COUNT(*) as count
            FROM applications
            WHERE is_deleted = 0
            AND date(applied_at) >= ?
            AND CAST(strftime('%w', applied_at) AS INTEGER) IN (0, 6)
            """,
            (start_of_week.isoformat(),)
        )
        return cursor.fetchone()["count"] > 0

    def _get_today_apps_count(self, cursor) -> int:
        """Get count of applications submitted today"""
        today = date.today()
        cursor.execute(
            """
            SELECT COUNT(*) as count
            FROM applications
            WHERE is_deleted = 0
            AND date(applied_at) = ?
            """,
            (today.isoformat(),)
        )
        return cursor.fetchone()["count"]

    def _get_this_week_apps_count(self, cursor) -> int:
        """Get count of applications submitted this week"""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        cursor.execute(
            """
            SELECT COUNT(*) as count
            FROM applications
            WHERE is_deleted = 0
            AND date(applied_at) >= ?
            """,
            (start_of_week.isoformat(),)
        )
        return cursor.fetchone()["count"]

    def _get_this_week_interviews(self, cursor) -> int:
        """Get count of interviews this week"""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        cursor.execute(
            """
            SELECT COUNT(DISTINCT a.id) as count
            FROM applications a
            JOIN application_events e ON e.application_id = a.id
            WHERE a.is_deleted = 0
            AND e.to_status = 'interviewing'
            AND date(e.timestamp) >= ?
            """,
            (start_of_week.isoformat(),)
        )
        return cursor.fetchone()["count"]

    def _get_this_week_responses(self, cursor) -> int:
        """Get count of responses (screening/interview/offer) this week"""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        cursor.execute(
            """
            SELECT COUNT(DISTINCT a.id) as count
            FROM applications a
            JOIN application_events e ON e.application_id = a.id
            WHERE a.is_deleted = 0
            AND e.to_status IN ('screening', 'interviewing', 'offer')
            AND date(e.timestamp) >= ?
            """,
            (start_of_week.isoformat(),)
        )
        return cursor.fetchone()["count"]

    def _get_this_month_apps_count(self, cursor) -> int:
        """Get count of applications submitted this month"""
        today = date.today()
        start_of_month = today.replace(day=1)
        cursor.execute(
            """
            SELECT COUNT(*) as count
            FROM applications
            WHERE is_deleted = 0
            AND date(applied_at) >= ?
            """,
            (start_of_month.isoformat(),)
        )
        return cursor.fetchone()["count"]

    def _get_unique_application_days(self, cursor) -> int:
        """Get count of unique days with at least one application"""
        cursor.execute(
            """
            SELECT COUNT(DISTINCT date(applied_at)) as count
            FROM applications
            WHERE is_deleted = 0
            """
        )
        return cursor.fetchone()["count"]

    def _check_fast_track(self, cursor) -> int:
        """Check if any offer was received within 2 weeks of applying"""
        cursor.execute(
            """
            SELECT COUNT(DISTINCT a.id) as count
            FROM applications a
            JOIN application_events e ON e.application_id = a.id
            WHERE a.is_deleted = 0
            AND e.to_status = 'offer'
            AND (julianday(e.timestamp) - julianday(a.applied_at)) <= 14
            """
        )
        return cursor.fetchone()["count"]

    def get_newly_unlocked(self, previous_stats: dict, current_stats: dict) -> list[dict]:
        """
        Compare previous and current stats to find newly unlocked achievements.
        Useful for triggering celebrations.
        """
        # This would be called when new applications are added
        # For now, return empty - could be enhanced with caching
        return []

